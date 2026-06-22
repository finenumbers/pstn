#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/pstn}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

if [[ ! -f .env ]]; then
  echo "Error: .env not found in $ROOT_DIR" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

POSTGRES_USER="${POSTGRES_USER:-pstn}"
POSTGRES_DB="${POSTGRES_DB:-pstn}"

mkdir -p "$BACKUP_DIR"
OUTPUT="$BACKUP_DIR/pstn_${TIMESTAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "$OUTPUT"

echo "Backup saved to $OUTPUT"
