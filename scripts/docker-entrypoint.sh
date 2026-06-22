#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-pstn}"
DB_PASS="${DB_PASS:-pstn}"
DB_NAME="${DB_NAME:-pstn}"
DB_PORT="${DB_PORT:-5432}"

# Build DATABASE_URL from DB_* so passwords with @ : / # etc. work (Portainer often sets a broken URL).
export DATABASE_URL="$(node -e "
  const user = process.env.DB_USER || 'pstn';
  const pass = process.env.DB_PASS || 'pstn';
  const host = process.env.DB_HOST || 'postgres';
  const db = process.env.DB_NAME || 'pstn';
  const port = process.env.DB_PORT || '5432';
  process.stdout.write(
    'postgresql://' +
    encodeURIComponent(user) + ':' +
    encodeURIComponent(pass) + '@' +
    host + ':' + port + '/' +
    encodeURIComponent(db)
  );
")"

ensure_external_api_key() {
  if [ -n "${EXTERNAL_API_KEY:-}" ]; then
    echo "Using EXTERNAL_API_KEY from environment"
    export EXTERNAL_API_KEY
    return
  fi

  SECRET_DIR="/app/.secrets"
  SECRET_FILE="${SECRET_DIR}/external_api_key"

  mkdir -p "$SECRET_DIR"
  chown nextjs:nodejs "$SECRET_DIR"

  if [ -f "$SECRET_FILE" ]; then
    EXTERNAL_API_KEY="$(cat "$SECRET_FILE")"
    export EXTERNAL_API_KEY
    return
  fi

  EXTERNAL_API_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
  printf '%s' "$EXTERNAL_API_KEY" > "$SECRET_FILE"
  chown nextjs:nodejs "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "Generated new EXTERNAL_API_KEY — retrieve from ${SECRET_FILE}"
  export EXTERNAL_API_KEY
}

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

ensure_external_api_key

echo "Starting PSTN Analytics on port ${PORT:-5555}..."
exec su-exec nextjs env EXTERNAL_API_KEY="${EXTERNAL_API_KEY}" node server.js
