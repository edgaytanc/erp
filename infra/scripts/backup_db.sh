#!/usr/bin/env sh
set -e

TS=$(date +"%Y%m%d_%H%M%S")
OUT_DIR="/backups"
FILE="${OUT_DIR}/erp_db_${TS}.sql.gz"

mkdir -p "$OUT_DIR"

docker exec -t erp_db_prod pg_dump -U erp_user -d erp_db | gzip > "$FILE"
echo "Backup creado: $FILE"
