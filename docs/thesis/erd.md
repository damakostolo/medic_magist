# Схема даних

Рядкові UUID забезпечують стабільні ідентифікатори. Час подій зберігається з часовим поясом (UTC на записі). `birth_date` — дата без часу. Зовнішні ключі та індекси задано в SQLAlchemy-моделях і застосовано Alembic-міграцією.

```mermaid
erDiagram
    users ||--o{ assessments : authors
    users ||--o{ audit_logs : actors
    patients ||--o{ encounters : has
    patients ||--o{ observations : has
    patients ||--o{ assessments : has
    encounters |o--o{ observations : groups
    model_versions ||--o{ assessments : versions
    users { string id PK string username string password_hash string role boolean active datetime created_at }
    patients { string id PK string code string name date birth_date string administrative_sex text notes boolean synthetic datetime created_at }
    encounters { string id PK string patient_id FK datetime occurred_at string kind text notes }
    observations { string id PK string patient_id FK string encounter_id FK string name float value string unit datetime measured_at string source text notes }
    model_versions { string id PK string scenario string version datetime trained_at json metadata_json }
    assessments { string id PK string patient_id FK string author_id FK string model_version_id FK string scenario json input_snapshot float probability float threshold datetime created_at }
    audit_logs { string id PK string actor_id FK string action string entity_type string entity_id datetime created_at }
```

`input_snapshot` не змінюється через API; редагування та видалення оцінок не передбачено. Журнал фіксує тип операції, актора, сутність та час без медичних значень.
