from __future__ import annotations

import csv
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ml.scenarios import SCENARIOS, public_scenarios, validate_features
from .auth import admin, current_user, hash_password, token_for, verify_password
from .db import get_db
from .models import Assessment, AuditLog, Encounter, ModelVersion, Observation, Patient, User

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "ml" / "artifacts"
app = FastAPI(title="MedInsight Research API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class LoginIn(BaseModel):
    username: str
    password: str


class PatientIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=120)
    birth_date: date
    administrative_sex: Literal["female", "male", "other", "unknown"]
    notes: str = Field(default="", max_length=2000)

    @field_validator("birth_date")
    @classmethod
    def past_date(cls, value):
        if value > date.today():
            raise ValueError("Дата народження не може бути в майбутньому")
        return value


class EncounterIn(BaseModel):
    occurred_at: datetime
    kind: str = Field(min_length=2, max_length=80)
    notes: str = Field(default="", max_length=2000)


class ObservationIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    value: float = Field(allow_inf_nan=False)
    unit: str = Field(min_length=1, max_length=40)
    measured_at: datetime
    source: str = Field(default="", max_length=120)
    notes: str = Field(default="", max_length=2000)
    encounter_id: str | None = None


class AssessmentIn(BaseModel):
    scenario: Literal["heart", "diabetes"]
    features: dict[str, str | float | int]


class UserIn(BaseModel):
    username: str = Field(pattern=r"^[a-zA-Z0-9_.-]{3,80}$")
    password: str = Field(min_length=12, max_length=100)
    role: Literal["admin", "doctor"]


class UserUpdate(BaseModel):
    active: bool | None = None
    password: str | None = Field(default=None, min_length=12)


def output(obj):
    return {column.name: getattr(obj, column.name) for column in obj.__table__.columns}


def log(db, actor, action, kind, target):
    db.add(AuditLog(actor_id=actor.id, action=action, entity_type=kind, entity_id=target))


def patient_or_404(db, patient_id):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(404, "Пацієнта не знайдено")
    return patient


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Конфлікт унікального ідентифікатора") from None


def aware(value: datetime):
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(422, "Дата й час мають містити часовий пояс")
    return value.astimezone(timezone.utc)


@app.get("/health/live")
def live():
    return {"status": "ok"}


@app.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(func.count()).select_from(User))
    return {"status": "ok", "models": {key: (ARTIFACTS / key / "model.joblib").exists() for key in SCENARIOS}}


@app.post("/api/auth/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username))
    if not user or not user.active or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Невірний логін або пароль")
    return {"access_token": token_for(user), "token_type": "bearer", "user": {"id": user.id, "username": user.username, "role": user.role}}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return {"id": user.id, "username": user.username, "role": user.role}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(current_user)):
    audits = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(500)).all()
    activity = {}
    for item in audits:
        day = item.created_at.date().isoformat()
        activity[day] = activity.get(day, 0) + 1
    return {"patients": db.scalar(select(func.count()).select_from(Patient)),
            "encounters": db.scalar(select(func.count()).select_from(Encounter)),
            "observations": db.scalar(select(func.count()).select_from(Observation)),
            "assessments": db.scalar(select(func.count()).select_from(Assessment)),
            "activity": [{"date": k, "count": v} for k, v in sorted(activity.items())]}


@app.get("/api/patients")
def patients(q: str = "", sex: str = "", sort: Literal["name", "created_at", "code"] = "created_at",
             direction: Literal["asc", "desc"] = "desc", page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=100),
             db: Session = Depends(get_db), user: User = Depends(current_user)):
    query = select(Patient)
    if q:
        query = query.where(or_(Patient.name.ilike(f"%{q}%"), Patient.code.ilike(f"%{q}%")))
    if sex:
        query = query.where(Patient.administrative_sex == sex)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    column = getattr(Patient, sort)
    items = db.scalars(query.order_by(column.asc() if direction == "asc" else column.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [output(p) for p in items], "total": total, "page": page, "size": size}


@app.post("/api/patients", status_code=201)
def create_patient(data: PatientIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient = Patient(**data.model_dump())
    db.add(patient); db.flush(); log(db, user, "create", "patient", patient.id); commit(db)
    return output(patient)


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return output(patient_or_404(db, patient_id))


@app.patch("/api/patients/{patient_id}")
def update_patient(patient_id: str, data: PatientIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient = patient_or_404(db, patient_id)
    for key, value in data.model_dump().items():
        setattr(patient, key, value)
    log(db, user, "update", "patient", patient.id); commit(db)
    return output(patient)


@app.delete("/api/patients/{patient_id}", status_code=204)
def delete_patient(patient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient = patient_or_404(db, patient_id)
    log(db, user, "delete", "patient", patient.id)
    db.delete(patient); commit(db)


@app.get("/api/patients/{patient_id}/encounters")
def encounters(patient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    return [output(x) for x in db.scalars(select(Encounter).where(Encounter.patient_id == patient_id).order_by(Encounter.occurred_at.desc())).all()]


@app.post("/api/patients/{patient_id}/encounters", status_code=201)
def create_encounter(patient_id: str, data: EncounterIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    item = Encounter(patient_id=patient_id, occurred_at=aware(data.occurred_at), kind=data.kind, notes=data.notes)
    db.add(item); db.flush(); log(db, user, "create", "encounter", item.id); commit(db)
    return output(item)


@app.get("/api/patients/{patient_id}/observations")
def observations(patient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    return [output(x) for x in db.scalars(select(Observation).where(Observation.patient_id == patient_id).order_by(Observation.measured_at.desc())).all()]


@app.post("/api/patients/{patient_id}/observations", status_code=201)
def create_observation(patient_id: str, data: ObservationIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    if data.encounter_id:
        encounter = db.get(Encounter, data.encounter_id)
        if not encounter or encounter.patient_id != patient_id:
            raise HTTPException(422, "Обстеження не належить пацієнту")
    item = Observation(**{**data.model_dump(), "patient_id": patient_id, "measured_at": aware(data.measured_at)})
    db.add(item); db.flush(); log(db, user, "create", "observation", item.id); commit(db)
    return output(item)


@app.patch("/api/observations/{observation_id}")
def update_observation(observation_id: str, data: ObservationIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(Observation, observation_id)
    if not item:
        raise HTTPException(404, "Показник не знайдено")
    if data.encounter_id:
        encounter = db.get(Encounter, data.encounter_id)
        if not encounter or encounter.patient_id != item.patient_id:
            raise HTTPException(422, "Обстеження не належить пацієнту")
    for key, value in data.model_dump().items():
        setattr(item, key, aware(value) if key == "measured_at" else value)
    log(db, user, "update", "observation", item.id); commit(db)
    return output(item)


@app.delete("/api/observations/{observation_id}", status_code=204)
def delete_observation(observation_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    item = db.get(Observation, observation_id)
    if not item:
        raise HTTPException(404, "Показник не знайдено")
    log(db, user, "delete", "observation", item.id)
    db.delete(item); commit(db)


@app.get("/api/scenarios")
def scenarios(user: User = Depends(current_user)):
    return public_scenarios()


def metadata_for(scenario: str):
    path = ARTIFACTS / scenario / "metrics.json"
    if not path.exists():
        raise HTTPException(503, f"Модель {scenario} ще не навчена")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/models")
def models(user: User = Depends(current_user)):
    result = []
    for scenario in SCENARIOS:
        try:
            result.append(metadata_for(scenario))
        except HTTPException:
            result.append({"scenario": scenario, "available": False})
    return result


@app.get("/api/models/{scenario}/comparison")
def model_comparison(scenario: Literal["heart", "diabetes"], user: User = Depends(current_user)):
    path = ARTIFACTS / scenario / "comparison.csv"
    if not path.exists():
        raise HTTPException(404, "Порівняння не знайдено")
    with path.open(encoding="utf-8", newline="") as handle:
        return [{key: (float(value) if key in {"cv_roc_auc", "accuracy", "precision", "recall", "specificity", "f1", "roc_auc", "brier"} else value)
                 for key, value in row.items()} for row in csv.DictReader(handle)]


@app.get("/api/models/{scenario}/plots/{name}")
def model_plot(scenario: Literal["heart", "diabetes"], name: Literal["confusion_matrix", "roc_curve", "class_distribution", "missing_values"], user: User = Depends(current_user)):
    path = ARTIFACTS / scenario / f"{name}.png"
    if not path.exists():
        raise HTTPException(404, "Графік не знайдено")
    return FileResponse(path, media_type="image/png")


@app.post("/api/patients/{patient_id}/assessments", status_code=201)
def assess(patient_id: str, data: AssessmentIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    try:
        features = validate_features(data.scenario, data.features)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    metadata = metadata_for(data.scenario)
    model = joblib.load(ARTIFACTS / data.scenario / "model.joblib")
    frame = pd.DataFrame([{k: (float(v) if k in [f[0] for f in SCENARIOS[data.scenario]["fields"] if f[2] == "number"] else v)
                           for k, v in features.items()}], columns=metadata["features"])
    probability = float(model.predict_proba(frame)[0, 1])
    version = db.scalar(select(ModelVersion).where(ModelVersion.version == metadata["version"]))
    if not version:
        version = ModelVersion(scenario=data.scenario, version=metadata["version"],
                               trained_at=datetime.fromisoformat(metadata["trained_at_utc"]), metadata_json=metadata)
        db.add(version); db.flush()
    item = Assessment(patient_id=patient_id, author_id=user.id, model_version_id=version.id,
                      scenario=data.scenario, input_snapshot=features, probability=probability,
                      threshold=metadata["threshold"])
    db.add(item); db.flush(); log(db, user, "assess", "assessment", item.id); commit(db)
    return assessment_output(item)


def assessment_output(item):
    return {**output(item), "model_version": item.model_version.version, "author": item.author.username}


@app.get("/api/patients/{patient_id}/assessments")
def assessments(patient_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    patient_or_404(db, patient_id)
    return [assessment_output(x) for x in db.scalars(select(Assessment).where(Assessment.patient_id == patient_id).order_by(Assessment.created_at.desc())).all()]


@app.get("/api/users")
def users(db: Session = Depends(get_db), user: User = Depends(admin)):
    return [{"id": x.id, "username": x.username, "role": x.role, "active": x.active, "created_at": x.created_at}
            for x in db.scalars(select(User).order_by(User.username)).all()]


@app.post("/api/users", status_code=201)
def create_user(data: UserIn, db: Session = Depends(get_db), user: User = Depends(admin)):
    item = User(username=data.username, password_hash=hash_password(data.password), role=data.role)
    db.add(item); db.flush(); log(db, user, "create", "user", item.id); commit(db)
    return {"id": item.id, "username": item.username, "role": item.role, "active": item.active}


@app.patch("/api/users/{user_id}")
def update_user(user_id: str, data: UserUpdate, db: Session = Depends(get_db), user: User = Depends(admin)):
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(404, "Користувача не знайдено")
    if item.id == user.id and data.active is False:
        raise HTTPException(422, "Не можна вимкнути власний обліковий запис")
    if data.active is not None:
        item.active = data.active
    if data.password:
        item.password_hash = hash_password(data.password)
    log(db, user, "update", "user", item.id); commit(db)
    return {"id": item.id, "username": item.username, "role": item.role, "active": item.active}


@app.get("/api/audit")
def audit(page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=100), db: Session = Depends(get_db), user: User = Depends(admin)):
    items = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [{**output(x), "actor": x.actor.username} for x in items],
            "total": db.scalar(select(func.count()).select_from(AuditLog))}
