#!/usr/bin/env bash
# ==============================================================================
# Script: migrate_db.sh
# Descripción: Automatiza la migración de datos desde SQLite hacia PostgreSQL
#              en un entorno dockerizado para el backend de Django.
# Uso: ./migrate_db.sh
# ==============================================================================

set -euo pipefail

# Asegurar que el script se ejecute desde la raíz del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================================"
echo "  Iniciando proceso de migración de base de datos (SQLite -> PostgreSQL)"
echo "========================================================================"

# ------------------------------------------------------------------------------
# 1. Hacer un dumpdata de la base de datos actual hacia un archivo datadump.json,
#    excluyendo contenttypes y auth.Permission.
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 1: Volcando datos de la base de datos actual a datadump.json..."

# Determinamos el método disponible para volcar los datos (Contenedor activo, Python local o docker compose run)
if docker ps --format '{{.Names}}' | grep -Eq "^erp_backend$"; then
    echo "    -> Contenedor erp_backend detectado en ejecución. Extrayendo datos..."
    docker exec erp_backend python manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output /app/datadump.json
    # Copiar el archivo al host
    docker cp erp_backend:/app/datadump.json ./datadump.json
    cp ./datadump.json ./backend/datadump.json 2>/dev/null || true
elif command -v python &> /dev/null && python -c "import django" &> /dev/null; then
    echo "    -> Usando entorno Python del sistema/host..."
    python backend/manage.py dumpdata \
        --natural-foreign \
        --natural-primary \
        --exclude contenttypes \
        --exclude auth.Permission \
        --indent 2 \
        --output datadump.json
    cp ./datadump.json ./backend/datadump.json
elif command -v python3 &> /dev/null && python3 -c "import django" &> /dev/null; then
    echo "    -> Usando entorno Python 3 del sistema/host..."
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
    docker compose -f docker-compose.dev.yml run --no-deps --rm \
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
# 2. Reconstruir y levantar los contenedores de desarrollo con
#    docker compose -f docker-compose.dev.yml up -d --build
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 2: Reconstruyendo y levantando contenedores de desarrollo..."
docker compose -f docker-compose.dev.yml up -d --build

echo "    -> Esperando a que el contenedor erp_backend y PostgreSQL estén listos..."
until [ "$(docker inspect -f '{{.State.Running}}' erp_backend 2>/dev/null)" = "true" ]; do
    sleep 2
done
# Breve pausa para asegurar inicialización de conexiones
sleep 5

# ------------------------------------------------------------------------------
# 3. Ejecutar python manage.py migrate en el contenedor erp_backend
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 3: Ejecutando migraciones en el contenedor erp_backend..."
docker exec -i erp_backend python manage.py migrate

# ------------------------------------------------------------------------------
# 4. Ejecutar python manage.py loaddata datadump.json en el contenedor erp_backend
# ------------------------------------------------------------------------------
echo ""
echo "==> Paso 4: Cargando datadump.json en el contenedor erp_backend..."

# Garantizar que datadump.json esté presente dentro del contenedor en /app/
docker cp ./datadump.json erp_backend:/app/datadump.json

docker exec -i erp_backend python manage.py loaddata datadump.json

echo ""
echo "========================================================================"
echo "  ¡Migración completada exitosamente!"
echo "  Tus datos han sido trasladados de SQLite a PostgreSQL."
echo "========================================================================"
