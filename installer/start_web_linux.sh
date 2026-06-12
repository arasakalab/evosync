#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVOLUTION_DIR="$ROOT_DIR/infra/evolution"
EVOLUTION_ENV="$EVOLUTION_DIR/.env"
WEB_DIR="$ROOT_DIR/evosync-web"
PORT="${PORT:-3000}"

cd "$ROOT_DIR"

if [ -f "$EVOLUTION_ENV" ]; then
  if ! docker compose --env-file "$EVOLUTION_ENV" -f "$EVOLUTION_DIR/compose.yaml" up -d; then
    printf '[EvoSync] Nao foi possivel subir a stack Docker. Verifique se o Docker esta aberto e se a porta 8080 esta livre.\n' >&2
    exit 1
  fi
else
  printf '[EvoSync] infra/evolution/.env nao encontrado. Rode installer/install_web_linux.sh primeiro.\n' >&2
  exit 1
fi

if [ ! -d "$WEB_DIR" ]; then
  printf '[EvoSync] Diretorio evosync-web nao encontrado.\n' >&2
  exit 1
fi

if [ ! -d "$WEB_DIR/node_modules" ]; then
  printf '[EvoSync] Dependencias nao instaladas. Rode installer/install_web_linux.sh primeiro.\n' >&2
  exit 1
fi

# Garante .env no evosync-web (espelha o .env da raiz)
if [ ! -f "$WEB_DIR/.env" ] && [ -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env" "$WEB_DIR/.env"
fi

# Garante build em prod
if [ ! -d "$WEB_DIR/.next" ]; then
  printf '[EvoSync] Build nao encontrado, gerando...\n'
  (cd "$WEB_DIR" && npm run build)
fi

cd "$WEB_DIR"
NODE_ENV=production PORT="$PORT" exec npm run start
