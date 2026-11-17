"""Real HTTP + PostgreSQL integration smoke test; creates only synthetic data."""
import secrets
from pathlib import Path

import httpx
from dotenv import dotenv_values
from ml.scenarios import SCENARIOS

ROOT = Path(__file__).resolve().parents[1]
env = dotenv_values(ROOT / ".env")
if not env.get("SEED_DOCTOR_PASSWORD"):
    raise RuntimeError("Set SEED_DOCTOR_PASSWORD in .env")

with httpx.Client(base_url="http://localhost:8000", timeout=30) as client:
    login = client.post("/api/auth/login", json={"username": "doctor", "password": env["SEED_DOCTOR_PASSWORD"]})
    login.raise_for_status()
    client.headers["Authorization"] = "Bearer " + login.json()["access_token"]
    patient = client.post("/api/patients", json={"code": "SMOKE-" + secrets.token_hex(4).upper(),
        "name": "Демо Smoke", "birth_date": "1980-01-02", "administrative_sex": "female", "notes": "Синтетичний тест"})
    patient.raise_for_status()
    patient_id = patient.json()["id"]
    try:
        visit = client.post(f"/api/patients/{patient_id}/encounters", json={"kind": "Тестове обстеження",
            "occurred_at": "2026-01-01T12:00:00+00:00", "notes": "Синтетично"})
        visit.raise_for_status()
        observation = client.post(f"/api/patients/{patient_id}/observations", json={"name": "Пульс", "value": 72,
            "unit": "уд/хв", "measured_at": "2026-01-01T12:05:00+00:00", "source": "Синтетично",
            "encounter_id": visit.json()["id"]})
        observation.raise_for_status()
        for scenario in SCENARIOS:
            features = {field[0]: (float(field[3]) if field[2] == "number" else next(iter(field[6])))
                        for field in SCENARIOS[scenario]["fields"]}
            assessment = client.post(f"/api/patients/{patient_id}/assessments",
                                     json={"scenario": scenario, "features": features})
            assessment.raise_for_status()
            assert 0 <= assessment.json()["probability"] <= 1
        history = client.get(f"/api/patients/{patient_id}/assessments")
        history.raise_for_status()
        assert len(history.json()) == 2
        print("PASS: login -> patient -> encounter -> observation -> two assessments -> history")
    finally:
        deletion = client.delete(f"/api/patients/{patient_id}")
        deletion.raise_for_status()
