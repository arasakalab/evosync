#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV="$ROOT_DIR/.env"
EVOLUTION_DIR="$ROOT_DIR/infra/evolution"
EVOLUTION_ENV="$EVOLUTION_DIR/.env"

info() {
  printf '\n[DisparoFacil] %s\n' "$1"
}

fail() {
  printf '\n[DisparoFacil] ERRO: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$2"
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    python3 -c "import secrets; print(secrets.token_hex($1))"
  fi
}

cd "$ROOT_DIR"

info "Verificando Docker Compose"
require_command docker "Docker nao encontrado. Instale o Docker Engine/Desktop: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose nao encontrado. Atualize o Docker para uma versao com 'docker compose'."

info "Verificando Python 3"
require_command python3 "Python 3 nao encontrado. Instale Python 3.10+ e rode novamente."

if [ ! -d "$ROOT_DIR/.venv" ]; then
  info "Criando ambiente virtual .venv"
  python3 -m venv "$ROOT_DIR/.venv"
else
  info "Ambiente virtual .venv ja existe"
fi

info "Instalando dependencias Python"
"$ROOT_DIR/.venv/bin/python" -m pip install --upgrade pip
"$ROOT_DIR/.venv/bin/pip" install -r "$ROOT_DIR/requirements.txt"

if [ ! -f "$APP_ENV" ]; then
  info "Criando .env do app"
  cat > "$APP_ENV" <<'EOF'
EVO_URL=http://localhost:8080
EVO_APIKEY=coloque_a_mesma_chave_de_AUTHENTICATION_API_KEY
EVO_INSTANCE=disparofacil
EOF
  chmod 600 "$APP_ENV" 2>/dev/null || true
else
  info ".env do app ja existe; preservando"
fi

if [ ! -f "$EVOLUTION_ENV" ]; then
  info "Criando configuracao da Evolution API"
  API_KEY="$(random_hex 24)"
  POSTGRES_PASSWORD="$(random_hex 18)"
  cat > "$EVOLUTION_ENV" <<EOF
EVOLUTION_PORT=8080
SERVER_URL=http://localhost:8080

AUTHENTICATION_API_KEY=$API_KEY

POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF
  chmod 600 "$EVOLUTION_ENV" 2>/dev/null || true
  info "Chave da Evolution gerada. Copie AUTHENTICATION_API_KEY de infra/evolution/.env para EVO_APIKEY no .env do app."
else
  info "infra/evolution/.env ja existe; preservando"
fi

if command -v opencode >/dev/null 2>&1; then
  info "OpenCode encontrado"
else
  info "OpenCode nao encontrado. Para usar IA, instale com: curl -fsSL https://opencode.ai/install | bash"
fi

info "Subindo Evolution API, PostgreSQL e Redis"
if ! docker compose --env-file "$EVOLUTION_ENV" -f "$EVOLUTION_DIR/compose.yaml" up -d; then
  fail "Nao foi possivel subir a stack Docker. Verifique se o Docker esta aberto e se a porta 8080 esta livre. Para trocar a porta, edite EVOLUTION_PORT em infra/evolution/.env e EVO_URL no .env do app."
fi

info "Instalacao concluida"
printf '\nEvolution API: http://localhost:8080\n'
printf 'App: bash installer/start_linux.sh\n\n'

"$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/main.py"
