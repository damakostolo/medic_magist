FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend /app/backend
COPY ml/__init__.py /app/ml/__init__.py
COPY ml/scenarios.py /app/ml/scenarios.py
ENV PYTHONPATH=/app:/app/backend
CMD ["sh", "-c", "cd /app/backend && alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
