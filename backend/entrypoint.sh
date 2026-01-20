#!/usr/bin/env sh
set -e

echo "Waiting for database..."
until python -c "import psycopg; psycopg.connect('${DATABASE_URL}').close()" 2>/dev/null; do
  sleep 1
done
echo "Database is up."

python manage.py migrate --noinput

exec "$@"
