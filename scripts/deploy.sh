#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy .env.production.example to .env first." >&2
  exit 1
fi

if [[ "${SKIP_GIT_PULL:-}" != "1" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull
fi

docker compose -f "${COMPOSE_FILE}" up -d --build
docker compose -f "${COMPOSE_FILE}" ps

echo ""
echo "Health: curl -sf http://127.0.0.1:\${APP_PORT:-5555}/api/health"
echo "Open /ranges → «Загрузить данные» for manual import."
