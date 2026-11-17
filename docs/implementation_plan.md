# План реалізації MedInsight

## Межі системи

Навчально-дослідний прототип для синтетичних карток. Публічні UCI-набори використовуються виключно для навчання й тестування моделей. Вихід моделі не є клінічним ризиком або діагнозом.

## Архітектура

React/TypeScript/Vite → REST FastAPI → SQLAlchemy 2 → PostgreSQL. Окремий відтворюваний Python-скрипт завантажує два UCI-набори, навчає sklearn Pipeline, зберігає joblib і виміряні артефакти. Backend читає лише готові версійні артефакти. Docker Compose запускає БД, API й frontend; Alembic виконує міграції перед стартом API.

## Дані й API

Таблиці: users, patients, encounters, observations, assessments, model_versions, audit_logs. UUID як первинні ключі; UTC для подій; зовнішні ключі й індекси. JWT Bearer із коротким строком дії, bcrypt; admin може керувати користувачами й читати аудит, doctor — синтетичними записами та оцінками.

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/dashboard`, `GET/POST /api/patients`, `GET/PATCH/DELETE /api/patients/{id}`
- `GET/POST /api/patients/{id}/encounters`, `GET/POST /api/patients/{id}/observations`, `PATCH/DELETE /api/observations/{id}`
- `GET /api/scenarios`, `GET /api/models`, `GET /api/models/{scenario}/comparison`, `GET /api/models/{scenario}/plots/{name}`, `POST /api/patients/{id}/assessments`, `GET /api/patients/{id}/assessments`
- `GET/POST/PATCH /api/users`, `GET /api/audit`, `GET /health/live`, `GET /health/ready`

Помилки: HTTP статус + `{detail: ...}`; сервер перевіряє ролі, діапазони й перелік ознак. Assessment зберігає незмінний JSON snapshot.

## Етапи та критерії готовності

1. Backend, схема, міграція, seed і авторизація: міграція проходить, API з ролями працює.
2. CRUD, dashboard, аудит і frontend: наскрізний сценарій створення синтетичної картки й показника проходить.
3. Два ML-пайплайни: реальні файли UCI, train/test до CV, артефакти та повторювана команда навчання; API використовує joblib.
4. Інтерфейс досліджень, історія оцінок і документи: дані UI походять з API, матеріали відбивають фактичні результати.
5. Перевірка: pytest, frontend build, Docker Compose, health і наскрізний API-сценарій; зафіксувати фактичний результат кожного.
