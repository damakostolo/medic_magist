"""Initial explicit schema.

Revision ID: 0001
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False),
        sa.Column("password_hash", sa.String(120), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table("patients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("administrative_sex", sa.String(16), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_patients_code", "patients", ["code"], unique=True)
    op.create_index("ix_patients_name", "patients", ["name"])

    op.create_table("model_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("scenario", sa.String(30), nullable=False),
        sa.Column("version", sa.String(100), nullable=False, unique=True),
        sa.Column("trained_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False))
    op.create_index("ix_model_versions_scenario", "model_versions", ["scenario"])

    op.create_table("encounters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False))
    op.create_index("ix_encounters_patient_id", "encounters", ["patient_id"])

    op.create_table("observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("encounter_id", sa.String(36), sa.ForeignKey("encounters.id", ondelete="SET NULL")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False))
    op.create_index("ix_observations_patient_id", "observations", ["patient_id"])
    op.create_index("ix_observations_measured_at", "observations", ["measured_at"])

    op.create_table("assessments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("model_version_id", sa.String(36), sa.ForeignKey("model_versions.id"), nullable=False),
        sa.Column("scenario", sa.String(30), nullable=False),
        sa.Column("input_snapshot", sa.JSON(), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_assessments_patient_id", "assessments", ["patient_id"])
    op.create_index("ix_assessments_created_at", "assessments", ["created_at"])
    op.create_index("ix_assessments_patient_time", "assessments", ["patient_id", "created_at"])

    op.create_table("audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("assessments")
    op.drop_table("observations")
    op.drop_table("encounters")
    op.drop_table("model_versions")
    op.drop_table("patients")
    op.drop_table("users")
