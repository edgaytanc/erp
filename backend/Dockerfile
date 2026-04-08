# backend/Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencias del sistema (psycopg, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Requisitos
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Código
COPY . /app

# (Opcional) usuario no-root para prod
# RUN useradd -m appuser && chown -R appuser:appuser /app
# USER appuser

EXPOSE 8000

# En dev lo sobreescribimos desde docker-compose
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
