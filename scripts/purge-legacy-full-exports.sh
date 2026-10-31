#!/bin/sh
# Delete xlsx files for historical full-plan exports before migration 0023.
# Refuses when an import or export heartbeat is fresher than 2 minutes.
# Missing files and a missing as_of column are not errors.
set -eu
# ash in the app image supports pipefail; a failed psql must fail the deploy.
if (set -o pipefail) 2>/dev/null; then
  set -o pipefail
fi

psql_q() {
  if [ -n "${DATABASE_URL:-}" ]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "$1"
  else
    PGPASSWORD="${DB_PASS:-${PGPASSWORD:-}}" psql \
      -h "${DB_HOST:-${PGHOST:-localhost}}" \
      -U "${DB_USER:-${PGUSER:-pstn}}" \
      -d "${DB_NAME:-${PGDATABASE:-pstn}}" \
      -p "${DB_PORT:-${PGPORT:-5432}}" \
      -v ON_ERROR_STOP=1 -tAc "$1"
  fi
}

trim() {
  printf '%s' "$1" | tr -d '[:space:]'
}

live="$(trim "$(psql_q "SELECT 1 WHERE EXISTS (SELECT 1 FROM import_jobs WHERE status IN ('pending', 'running') AND updated_at > now() - interval '2 minutes') OR EXISTS (SELECT 1 FROM export_jobs WHERE status IN ('pending', 'running') AND updated_at > now() - interval '2 minutes')")")"
if [ "$live" = "1" ]; then
  echo "0023 refused: import or export is in progress" >&2
  exit 1
fi

has_as_of="$(trim "$(psql_q "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'export_jobs' AND column_name = 'as_of'")")"
if [ "$has_as_of" = "1" ]; then
  query="SELECT file_path FROM export_jobs WHERE file_path IS NOT NULL AND (dataset LIKE 'full:%' OR as_of IS NOT NULL)"
else
  query="SELECT file_path FROM export_jobs WHERE file_path IS NOT NULL AND dataset LIKE 'full:%'"
fi

export_dir="${EXPORT_DIR:-/app/data/exports}"
case "$export_dir" in
  */) ;;
  *) export_dir="${export_dir}/" ;;
esac

psql_q "$query" | while IFS= read -r path; do
  path="$(printf '%s' "$path" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -n "$path" ] || continue
  case "$path" in
    *..*)
      echo "skip export file with parent segment: $path" >&2
      continue
      ;;
  esac
  case "$path" in
    "$export_dir"*)
      if [ -f "$path" ]; then
        rm -f -- "$path"
      fi
      ;;
    *)
      echo "skip export file outside EXPORT_DIR: $path" >&2
      ;;
  esac
done
