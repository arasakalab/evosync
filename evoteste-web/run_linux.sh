#!/usr/bin/env bash
# Inicia o EvoTeste web (Next.js 14 + WebSocket + scheduler).
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "[evoteste-web] instalando dependências (npm install)..."
  npm install
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[evoteste-web] .env criado a partir de .env.example — preencha EVO_APIKEY."
fi

# Em produção, garante build
if [ "${NODE_ENV:-}" = "production" ] && [ ! -d .next ]; then
  echo "[evoteste-web] gerando build de produção..."
  npm run build
fi

exec npm run start
