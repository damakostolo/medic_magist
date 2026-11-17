import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["JWT_SECRET"] = "test-only-secret-long-enough-for-jwt"

from app.auth import hash_password
from app.db import Base, get_db
from app.main import app, ARTIFACTS
from app.models import User
from ml.scenarios import SCENARIOS


@pytest.fixture
def client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with sessions() as db:
        db.add_all([User(username="doctor", role="doctor", password_hash=hash_password("doctor-password-123")),
                    User(username="admin", role="admin", password_hash=hash_password("admin-password-123"))])
        db.commit()
    def override():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


def login(client, username="doctor", password="doctor-password-123"):
    result = client.post("/api/auth/login", json={"username": username, "password": password})
    assert result.status_code == 200, result.text
    return {"Authorization": f"Bearer {result.json()['access_token']}"}


def create_patient(client, headers):
    result = client.post("/api/patients", headers=headers, json={"code": "DEMO-T1", "name": "Демо Тест", "birth_date": "1980-01-02", "administrative_sex": "female", "notes": "Синтетично"})
    assert result.status_code == 201, result.text
    return result.json()["id"]


def test_auth_and_roles(client):
    assert client.get("/api/patients").status_code == 403
    assert client.post("/api/auth/login", json={"username": "doctor", "password": "wrong"}).status_code == 401
    doctor = login(client)
    assert client.get("/api/users", headers=doctor).status_code == 403
    assert client.get("/api/audit", headers=doctor).status_code == 403
    admin = login(client, "admin", "admin-password-123")
    assert client.get("/api/users", headers=admin).status_code == 200


def test_patient_observation_and_audit(client):
    headers = login(client)
    patient_id = create_patient(client, headers)
    visit = client.post(f"/api/patients/{patient_id}/encounters", headers=headers,
                        json={"kind": "Консультація", "occurred_at": "2026-01-01T12:00:00+00:00", "notes": "Демо"})
    assert visit.status_code == 201, visit.text
    observation = client.post(f"/api/patients/{patient_id}/observations", headers=headers,
                              json={"name": "Пульс", "value": 72, "unit": "уд/хв", "measured_at": "2026-01-01T12:05:00+00:00",
                                    "source": "Синтетичний", "encounter_id": visit.json()["id"]})
    assert observation.status_code == 201, observation.text
    assert client.get(f"/api/patients/{patient_id}/observations", headers=headers).json()[0]["value"] == 72
    assert client.get("/api/dashboard", headers=headers).json()["observations"] == 1
    assert client.get("/api/patients?q=Тест", headers=headers).json()["total"] == 1
    admin = login(client, "admin", "admin-password-123")
    assert client.get("/api/audit", headers=admin).json()["total"] == 3
    assert client.delete(f"/api/patients/{patient_id}", headers=headers).status_code == 204
    assert client.get(f"/api/patients/{patient_id}", headers=headers).status_code == 404


@pytest.mark.parametrize("scenario", ["heart", "diabetes"])
def test_assessment_matches_saved_model(client, scenario):
    headers = login(client)
    patient_id = create_patient(client, headers)
    fields = SCENARIOS[scenario]["fields"]
    features = {f[0]: (float(f[3]) if f[2] == "number" else next(iter(f[6]))) for f in fields}
    result = client.post(f"/api/patients/{patient_id}/assessments", headers=headers,
                         json={"scenario": scenario, "features": features})
    assert result.status_code == 201, result.text
    saved = result.json()
    model = joblib.load(ARTIFACTS / scenario / "model.joblib")
    expected = model.predict_proba(pd.DataFrame([features]))[0, 1]
    assert saved["probability"] == pytest.approx(expected)
    history = client.get(f"/api/patients/{patient_id}/assessments", headers=headers).json()
    assert history[0]["input_snapshot"] == features
    assert history[0]["model_version"] == saved["model_version"]
    bad = dict(features); bad["unknown"] = 1
    assert client.post(f"/api/patients/{patient_id}/assessments", headers=headers,
                       json={"scenario": scenario, "features": bad}).status_code == 422


def test_model_artifacts_and_admin_creation(client):
    headers = login(client)
    models = client.get("/api/models", headers=headers).json()
    assert {m["scenario"] for m in models} == {"heart", "diabetes"}
    assert all(m["rows"] > 0 for m in models)
    assert client.get("/api/models/heart/plots/roc_curve", headers=headers).status_code == 200
    comparison = client.get("/api/models/heart/comparison", headers=headers)
    assert comparison.status_code == 200 and len(comparison.json()) == 2
    admin = login(client, "admin", "admin-password-123")
    created = client.post("/api/users", headers=admin, json={"username": "doctor2", "password": "another-strong-123", "role": "doctor"})
    assert created.status_code == 201, created.text
    assert client.patch(f"/api/users/{created.json()['id']}", headers=admin, json={"active": False}).status_code == 200
    assert client.post("/api/auth/login", json={"username": "doctor2", "password": "another-strong-123"}).status_code == 401
