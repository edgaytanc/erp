#!/usr/bin/env bash
# ==============================================================================
# Script: migrate_db.sh
# Descripción: Automatiza la migración de datos desde SQLite hacia PostgreSQL
#              en Docker, con soporte tanto para Desarrollo como para Producción.
# Uso:
#   ./migrate_db.sh          # Por defecto: entorno de desarrollo (dev)
#   ./migrate_db.sh dev      # Entorno de desarrollo
#   ./migrate_db.sh prod     # Entorno de producción
# ==============================================================================

set -euo pipefail

# Asegurar ejecución desde la raíz del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Determinar el entorno (dev o prod)
TARGET_ENV="${1:-dev}"

if [ "$TARGET_ENV" = "prod" ] || [ "$TARGET_ENV" = "production" ]; then
    ENV_NAME="PRODUCCIÓN"
    COMPOSE_FILE="docker-compose.prod.yml"
    BACKEND_CONTAINER="erp_backend_prod"
    ENV_FILE_ARG="--env-file infra/env/.env"
    RUN_COLLECTSTATIC=true
elif [ "$TARGET_ENV" = "dev" ] || [ "$TARGET_ENV" = "development" ]; then
    ENV_NAME="DESARROLLO"
    COMPOSE_FILE="docker-compose.dev.yml"
    BACKEND_CONTAINER="erp_backend"
    ENV_FILE_ARG=""
    RUN_COLLECTSTATIC=false
else
    echo "Error: Entorno no reconocido '$TARGET_ENV'. Usa 'dev' o 'prod'."
    echo "Uso: $0 [dev|prod]"
    exit 1
fi

echo "========================================================================"
echo "  Iniciando migración de base de datos (SQLite -> PostgreSQL)"
echo "  Entorno objetivo: $ENV_NAME"
echo "  Archivo compose:  $COMPOSE_FILE"
echo "  Contenedor:       $BACKEND_CONTAINER"
echo "========================================================================"

# ------------------------------------------------------------------------------
# 1. Hacer un dumpdata de la base de datos actual hacia un archivo datadump.json,
#    excluyendo contenttypes y auth.Permission.
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 1: Volcando datos de la base de datos actual a datadump.json..."

if docker ps --format '{{.Names}}' | grep -Eq "^${BACKEND_CONTAINER}$"; then
    echo "    -> Contenedor ${BACKEND_CONTAINER} en ejecución. Extrayendo datos..."
    docker exec "$BACKEND_CONTAINER" python manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output /app/datadump.json
    docker cp "${BACKEND_CONTAINER}:/app/datadump.json" ./datadump.json
    cp ./datadump.json ./backend/datadump.json 2>/dev/null || true
elif command -v python &> /dev/null && python -c "import django" &> /dev/null; then
    echo "    -> Usando entorno Python del host..."
    python backend/manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output datadump.json
    cp ./datadump.json ./backend/datadump.json
elif command -v python3 &> /dev/null && python3 -c "import django" &> /dev/null; then
    echo "    -> Usando entorno Python 3 del host..."
    python3 backend/manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output datadump.json
    cp ./datadump.json ./backend/datadump.json
else
    echo "    -> Levantando contenedor auxiliar temporal para volcar base SQLite..."
    # shellcheck disable=SC2086
    docker compose -f "$COMPOSE_FILE" $ENV_FILE_ARG run --no-deps --rm \
        -e DATABASE_URL="" \
        backend python manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output /app/datadump.json
    cp ./backend/datadump.json ./datadump.json 2>/dev/null || true
fi

if [ ! -f "datadump.json" ]; then
    echo "Error: No se pudo generar el archivo datadump.json."
    exit 1
fi

echo "    -> datadump.json generado exitosamente."

# ------------------------------------------------------------------------------
# 2. Reconstruir y levantar los contenedores con docker compose
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 2: Reconstruyendo y levantando contenedores ($ENV_NAME)..."
# shellcheck disable=SC2086
docker compose -f "$COMPOSE_FILE" $ENV_FILE_ARG up -d --build

echo "    -> Esperando a que el contenedor ${BACKEND_CONTAINER} esté listo..."
until [ "$(docker inspect -f '{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null)" = "true" ]; do
    sleep 2
done
sleep 5

# ------------------------------------------------------------------------------
# 3. Ejecutar python manage.py migrate en el contenedor backend
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 3: Ejecutando migraciones en el contenedor ${BACKEND_CONTAINER}..."
docker exec -i "$BACKEND_CONTAINER" python manage.py migrate

# ------------------------------------------------------------------------------
# 4. Ejecutar python manage.py loaddata datadump.json en el contenedor backend
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 4: Cargando datadump.json en el contenedor ${BACKEND_CONTAINER}..."

docker cp ./datadump.json "${BACKEND_CONTAINER}:/app/datadump.json"
docker exec -i "$BACKEND_CONTAINER" python manage.py loaddata datadump.json

# ------------------------------------------------------------------------------
# 5. Tareas adicionales en producción (collectstatic)
# ------------------------------------------------------------------------------
if [ "$RUN_COLLECTSTATIC" = true ]; then
    echo ""
    echo "==> Paso 5 (Producción): Recolectando archivos estáticos..."
    docker exec -i "$BACKEND_CONTAINER" python manage.py collectstatic --noinput
fi

echo ""
echo "========================================================================"
echo "  ¡Migración completada exitosamente en $ENV_NAME!"
echo "  Tus datos han sido trasladados de SQLite a PostgreSQL."
echo "========================================================================"
