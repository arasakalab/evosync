#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV="$ROOT_DIR/.env"
EVOLUTION_DIR="$ROOT_DIR/infra/evolution"
EVOLUTION_ENV="$EVOLUTION_DIR/.env"
WEB_DIR="$ROOT_DIR/evosync-web"

info() {
  printf '\n[EvoSync] %s\n' "$1"
}

fail() {
  printf '\n[EvoSync] ERRO: %s\n' "$1" >&2
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

info "Verificando Node.js 18+"
require_command node "Node.js nao encontrado. Instale Node 18+ antes: https://nodejs.org/"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  fail "Node 18+ necessario. Detectado: $(node --version)"
fi

if [ ! -d "$WEB_DIR" ]; then
  fail "Diretorio evosync-web nao encontrado."
fi

if [ ! -d "$WEB_DIR/node_modules" ]; then
  info "Instalando dependencias do evosync-web (npm install)..."
  (cd "$WEB_DIR" && npm install)
else
  info "Dependencias do evosync-web ja instaladas"
fi

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

# Reaproveita o mesmo .env do app Python (EVO_URL/EVO_APIKEY/EVO_INSTANCE).
# O backend do evosync-web lê o .env da raiz do projeto, então mantemos compatibilidade.
if [ ! -f "$WEB_DIR/.env" ]; then
  cp "$APP_ENV" "$WEB_DIR/.env" 2>/dev/null || cp "$WEB_DIR/.env.example" "$WEB_DIR/.env"
  chmod 600 "$WEB_DIR/.env" 2>/dev/null || true
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
  info "Chave da Evolution gerada. Copie AUTHENTICATION_API_KEY de infra/evolution/.env para EVO_APIKEY no .env."
else
  info "infra/evolution/.env ja existe; preservando"
fi

if command -v opencode >/dev/null 2>&1; then
  info "OpenCode encontrado"
else
  info "OpenCode nao encontrado (opcional). Para usar IA, instale: curl -fsSL https://opencode.ai/install | bash"
fi

info "Subindo Evolution API, PostgreSQL e Redis"
if ! docker compose --env-file "$EVOLUTION_ENV" -f "$EVOLUTION_DIR/compose.yaml" up -d; then
  fail "Nao foi possivel subir a stack Docker. Verifique se o Docker esta aberto e se a porta 8080 esta livre. Para trocar a porta, edite EVOLUTION_PORT em infra/evolution/.env e EVO_URL no .env do app."
fi

info "Build de producao (Next.js)"
(cd "$WEB_DIR" && npm run build)

info "Instalacao concluida"
printf '\nEvolution API: http://localhost:8080\n'
printf 'EvoSync web:   http://localhost:3000\n\n'
printf 'Para iniciar: bash installer/start_web_linux.sh\n\n'
