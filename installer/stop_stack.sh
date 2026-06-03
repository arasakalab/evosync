#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVOLUTION_DIR="$ROOT_DIR/infra/evolution"
EVOLUTION_ENV="$EVOLUTION_DIR/.env"

if [ -f "$EVOLUTION_ENV" ]; then
  docker compose --env-file "$EVOLUTION_ENV" -f "$EVOLUTION_DIR/compose.yaml" down
else
  docker compose -f "$EVOLUTION_DIR/compose.yaml" down
fi
