import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    birth_date: Mapped[date] = mapped_column(Date)
    administrative_sex: Mapped[str] = mapped_column(String(16))
    notes: Mapped[str] = mapped_column(Text, default="")
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    encounters: Mapped[list["Encounter"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    observations: Mapped[list["Observation"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    assessments: Mapped[list["Assessment"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)


class Encounter(Base):
    __tablename__ = "encounters"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(String(80))
    notes: Mapped[str] = mapped_column(Text, default="")
    observations: Mapped[list["Observation"]] = relationship(passive_deletes=True)


class Observation(Base):
    __tablename__ = "observations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    encounter_id: Mapped[str | None] = mapped_column(ForeignKey("encounters.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(40))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class ModelVersion(Base):
    __tablename__ = "model_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    scenario: Mapped[str] = mapped_column(String(30), index=True)
    version: Mapped[str] = mapped_column(String(100), unique=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metadata_json: Mapped[dict] = mapped_column(JSON)


class Assessment(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    model_version_id: Mapped[str] = mapped_column(ForeignKey("model_versions.id"))
    scenario: Mapped[str] = mapped_column(String(30))
    input_snapshot: Mapped[dict] = mapped_column(JSON)
    probability: Mapped[float] = mapped_column(Float)
    threshold: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    author: Mapped[User] = relationship()
    model_version: Mapped[ModelVersion] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    actor: Mapped[User] = relationship()

Index("ix_assessments_patient_time", Assessment.patient_id, Assessment.created_at)
