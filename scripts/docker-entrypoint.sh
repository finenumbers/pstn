#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-pstn}"
DB_PASS="${DB_PASS:-pstn}"
DB_NAME="${DB_NAME:-pstn}"

echo "Waiting for PostgreSQL at ${DB_HOST}..."
until PGPASSWORD="$DB_PASS" pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 2
done

echo "Running database migrations..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

for migration in packages/db/migrations/*.sql; do
  filename="$(basename "$migration")"
  applied="$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM schema_migrations WHERE filename = '${filename}'" 2>/dev/null | tr -d '[:space:]')"

  if [ "$applied" = "1" ]; then
    echo "Skip ${filename} (already applied)"
    continue
  fi

  echo "Applying ${migration}..."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$migration"

  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "INSERT INTO schema_migrations (filename) VALUES ('${filename}')"
done

echo "Starting PSTN Analytics on port ${PORT:-5555}..."
exec node server.js
