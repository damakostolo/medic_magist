# MedInsight

Навчально-дослідний прототип інформаційної системи для синтетичних медичних карток та двох відтворюваних ML-експериментів. **Не є медичним виробом. Вихід моделі не є діагнозом, клінічним ризиком або порадою щодо лікування.** Не вводьте реальні персональні дані.

## Що працює

- Ролі `admin` і `doctor`, JWT, bcrypt, серверна перевірка доступу, аудит створення/зміни/оцінки.
- PostgreSQL, Alembic, синтетичні пацієнти, обстеження, показники, пошук/фільтри/пагінація, історія ML-оцінок.
- Дві незалежні моделі на UCI Cleveland (ID 45) та Early Stage Diabetes (ID 529); train/test split, CV тільки на train, метрики й графіки з фактичних значень.
- React/TypeScript інтерфейс українською. API-документація: `/docs`.

## Перший запуск на Windows + Docker Desktop

Потрібні Docker Desktop з увімкненим Linux engine, Python 3.12, Node 22 для локального навчання та збірки. У PowerShell з кореня репозиторію:

```powershell
Copy-Item .env.example .env
```

У `.env` замініть усі значення `change-this-*` на випадкові секрети. `DATABASE_URL` має містити той самий пароль, що `POSTGRES_PASSWORD`. **Файл `.env` виключено з Git.** У поточному робочому просторі локальний `.env` уже створено з випадковими значеннями. Демонстраційні паролі для `admin` і `doctor` беруться з `SEED_ADMIN_PASSWORD` та `SEED_DOCTOR_PASSWORD`; у репозиторії їх немає.

Моделі та графіки вже збережені в `ml/artifacts/`. Для повторного навчання:

```powershell
python -m pip install -r ml/requirements.txt
python -m ml.training.train
```

Скрипт завантажує офіційні ZIP-файли до `ml/data/` (папка виключена з Git), перевіряє їх SHA-256 у метаданих і повторно використовує локальну копію. Якщо мережа недоступна, можна передати офіційний архів вручну:

```powershell
python -m ml.training.train --scenario heart --archive C:\path\heart.zip
python -m ml.training.train --scenario diabetes --archive C:\path\diabetes.zip
```

Запуск сервісів:

```powershell
docker compose up --build -d
docker compose ps
python -m scripts.smoke_http
```

Відкрийте [інтерфейс](http://localhost:5173) та. Backend автоматично виконує `alembic upgrade head` і створює два облікові записи та дві **синтетичні** картки. Оновлення seed не змінює паролі вже створених користувачів; для зміни скористайтесь адміністративним API/UI. Зупинка: `docker compose down`. Команда без `-v` зберігає базу.

## Локальна розробка

```powershell
python -m pip install -r backend/requirements.txt
$env:PYTHONPATH = "$PWD;$PWD\backend"
$env:DATABASE_URL = "sqlite:///./medinsight-dev.db"
$env:JWT_SECRET = "локальний-секрет-довший-за-24-символи"
$env:SEED_ADMIN_PASSWORD = "локальний-пароль-admin-123"
$env:SEED_DOCTOR_PASSWORD = "локальний-пароль-doctor-123"
Set-Location backend
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

В іншому терміналі: `cd frontend; npm ci; npm run dev`. SQLite призначено тільки для швидкої локальної розробки/тестів; цільова конфігурація — PostgreSQL у Compose.

## Перевірки

```powershell
cd backend
python -m pytest -q
cd ../frontend
npm ci
npm run build
npm audit --omit=dev
cd ..
docker compose ps
```

`GET /health/live` перевіряє процес, `GET /health/ready` — БД і наявність моделей. Наскрізний тест API: логін → пацієнт → обстеження → показник → ML-оцінка → історія. Результати поточного виконання — у [`docs/thesis/testing.md`](docs/thesis/testing.md).

## Структура

- `backend/app` — API, моделі БД, авторизація, seed; `backend/alembic` — міграція; `backend/tests` — API-тести.
- `frontend/src` — сторінки та компоненти React.
- `ml/training` — завантаження/очищення/навчання; `ml/artifacts/{heart,diabetes}` — моделі, метрики й графіки.
- `docs/implementation_plan.md`, `docs/thesis/` — план і матеріали для магістерської.

## Обмеження

Набори малі та зміщені; для diabetes 269 повторених рядків видалено перед split. Високі test-метрики не означають придатність до клініки. Зовнішньої клінічної валідації, калібрування під популяцію, FHIR API і нормативної сертифікації немає. Схема лише концептуально співвідноситься з FHIR Patient/Observation. Демонстраційний сервер не призначений для реальних даних.
