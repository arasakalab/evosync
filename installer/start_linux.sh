#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVOLUTION_DIR="$ROOT_DIR/infra/evolution"
EVOLUTION_ENV="$EVOLUTION_DIR/.env"

cd "$ROOT_DIR"

if [ -f "$EVOLUTION_ENV" ]; then
  if ! docker compose --env-file "$EVOLUTION_ENV" -f "$EVOLUTION_DIR/compose.yaml" up -d; then
    printf '[EvoSync] Nao foi possivel subir a stack Docker. Verifique se o Docker esta aberto e se a porta 8080 esta livre.\n' >&2
    exit 1
  fi
else
  printf '[EvoSync] infra/evolution/.env nao encontrado. Rode installer/install_linux.sh primeiro.\n' >&2
  exit 1
fi

if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  "$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/main.py"
else
  python3 "$ROOT_DIR/main.py"
fi
