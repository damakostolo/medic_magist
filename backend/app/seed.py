import os
from datetime import date, datetime, timezone
from .db import SessionLocal
from .models import Patient, User
from .auth import hash_password


def seed():
    with SessionLocal() as db:
        for role in ("admin", "doctor"):
            password = os.getenv(f"SEED_{role.upper()}_PASSWORD")
            if not password or len(password) < 12 or password.startswith("change-this"):
                raise RuntimeError(f"SEED_{role.upper()}_PASSWORD must be changed and contain at least 12 characters")
            if not db.query(User).filter_by(username=role).first():
                db.add(User(username=role, password_hash=hash_password(password), role=role))
        if not db.query(Patient).first():
            db.add_all([
                Patient(code="DEMO-001", name="Демо Олена", birth_date=date(1978, 5, 12), administrative_sex="female", notes="Синтетичний навчальний запис"),
                Patient(code="DEMO-002", name="Демо Андрій", birth_date=date(1965, 9, 3), administrative_sex="male", notes="Синтетичний навчальний запис"),
            ])
        db.commit()


if __name__ == "__main__":
    seed()
