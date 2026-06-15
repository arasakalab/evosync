#!/usr/bin/env bash
# =============================================================================
# EvoSync — onboard-tenant.sh
#
# Provisiona 1 instância da Evolution API para um novo tenant B2B.
# Para uso pelo SaaS provider (você) num VPS já com:
#   - Docker rodando
#   - Container Postgres (default: disparofacil_postgres) com DB criado
#   - Container Redis (default: disparofacil_redis)
#   - Network Docker compartilhada (default: evolution-shared)
#   - nginx + certbot instalados (se quiser subdomínio)
#
# Uso:
#   bash installer/onboard-tenant.sh <SLUG> [flags]
#
# Exemplos:
#   bash installer/onboard-tenant.sh acme
#   bash installer/onboard-tenant.sh padaria-do-ze --no-domain
#   EVOLUTION_PORT_BASE=9000 bash installer/onboard-tenant.sh imob-sp
#
# Saída imprime URL + API Key prontos pra mandar pro cliente.
# Mapeamento também é salvo em ~/evo-keys.txt (chmod 600).
#
# Idempotência: se container ou DB com mesmo slug já existir, ABORTA sem
# sobrescrever (fail-safe).
# =============================================================================

set -euo pipefail

# === CONFIGURÁVEL VIA ENV ===
EVOLUTION_PORT_BASE="${EVOLUTION_PORT_BASE:-8081}"
MAX_PORT="${MAX_PORT:-8199}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-disparofacil_postgres}"
POSTGRES_USER="${POSTGRES_USER:-evolution}"
EVOLUTION_NETWORK="${EVOLUTION_NETWORK:-evolution-shared}"
EVOLUTION_IMAGE="${EVOLUTION_IMAGE:-evoapicloud/evolution-api:latest}"
DOMAIN_BASE="${DOMAIN_BASE:-evosync.com.br}"
EVOLUTION_DOMAIN_PREFIX="${EVOLUTION_DOMAIN_PREFIX:-evo}"
NGINX_SITES_AVAILABLE="${NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}"
NGINX_SITES_ENABLED="${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
EMAIL_ADMIN="${EMAIL_ADMIN:-admin@${DOMAIN_BASE}}"
KEYS_LOG="${KEYS_LOG:-$HOME/evo-keys.txt}"
SERVER_IP="${SERVER_IP:-}"

# === CORES (cosmético) ===
if [ -t 1 ]; then
  C_BOLD="\033[1m"; C_DIM="\033[2m"; C_RED="\033[31m"
  C_GREEN="\033[32m"; C_YELLOW="\033[33m"; C_BLUE="\033[34m"
  C_RESET="\033[0m"
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""
  C_YELLOW=""; C_BLUE=""; C_RESET=""
fi

# === HELPERS ===
info()    { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$1"; }
ok()      { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
warn()    { printf '\n%s⚠%s  %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
fail()    { printf '\n%s✗ ERRO:%s %s\n\n' "$C_RED" "$C_RESET" "$1" >&2; exit 1; }
section() { printf '\n%s── %s ──%s\n' "$C_BOLD" "$1" "$C_RESET"; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 não encontrado. Instale e rode novamente."
}

usage() {
  cat <<EOF
Uso: bash $0 <SLUG> [flags]

Argumentos:
  SLUG    Identificador único do tenant (2-40 chars: a-z, 0-9, hífen)

Flags:
  --no-domain    Não criar vhost nginx + certbot
  --no-log       Não salvar mapeamento em KEYS_LOG
  -h, --help     Mostrar esta ajuda

Variáveis de ambiente (opcional):
  EVOLUTION_PORT_BASE    Porta inicial (default: 8081)
  EVOLUTION_NETWORK      Network Docker (default: evolution-shared)
  EVOLUTION_IMAGE        Imagem Docker (default: evoapicloud/evolution-api:latest)
  DOMAIN_BASE            Domínio base p/ subdomínios (default: evosync.com.br)
  EVOLUTION_DOMAIN_PREFIX Prefixo do subdomínio (default: evo)
  EMAIL_ADMIN            Email p/ certbot (default: admin@<DOMAIN_BASE>)
  KEYS_LOG               Onde salvar slug→key (default: ~/evo-keys.txt)
  SERVER_IP              IP do VPS p/ fallback se não usar subdomínio
  POSTGRES_CONTAINER     Container do Postgres (default: disparofacil_postgres)
  POSTGRES_USER          User do Postgres (default: evolution)
  MAX_PORT               Última porta possível (default: 8199)

Exemplos:
  bash $0 acme
  bash $0 padaria-do-ze --no-domain
  EVOLUTION_PORT_BASE=9000 bash $0 imob-sp

Saída: URL + API Key impressos no fim (manda pro cliente pela sua UI de mensageria).
EOF
}

# === PARSE DE ARGUMENTOS ===
SLUG=""
NO_DOMAIN=0
NO_LOG=0
for arg in "$@"; do
  case "$arg" in
    --no-domain) NO_DOMAIN=1 ;;
    --no-log) NO_LOG=1 ;;
    -h|--help) usage; exit 0 ;;
    --no-domain=*|--no-log=*|*)
      if [ -z "$SLUG" ]; then
        if [[ "$arg" == --*=* ]]; then
          SLUG="${arg#--*=}"
        elif [ "$arg" = "--no-domain" ] || [ "$arg" = "--no-log" ]; then
          # Já tratado acima
          continue
        else
          SLUG="$arg"
        fi
      else
        fail "Argumento extra: $arg"
      fi
      ;;
  esac
done

# === VALIDAÇÕES INICIAIS ===
section "Validações iniciais"

[ -z "$SLUG" ] && { usage; exit 1; }

if ! [[ "$SLUG" =~ ^[a-z0-9-]{2,40}$ ]]; then
  fail "Slug inválido '$SLUG'. Use 2-40 chars: a-z, 0-9, hífen."
fi

require_command docker
require_command openssl
require_command ss
require_command curl

if ! docker info >/dev/null 2>&1; then
  fail "Docker não está respondendo. Está rodando?"
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
  fail "Container Postgres '${POSTGRES_CONTAINER}' não está rodando.\n   Suba a stack base: cd infra/evolution && docker compose up -d"
fi

if ! docker network inspect "$EVOLUTION_NETWORK" >/dev/null 2>&1; then
  fail "Network Docker '${EVOLUTION_NETWORK}' não existe.\n   Crie: docker network create $EVOLUTION_NETWORK"
fi

# Idempotência: aborta se container ou DB já existe
if docker ps -a --format '{{.Names}}' | grep -q "^evo_${SLUG}$"; then
  fail "Container 'evo_${SLUG}' já existe. Abortando para não sobrescrever.\n   Para recriar: docker rm -f evo_${SLUG} e rode novamente (CUIDADO)."
fi

DB_EXISTS=$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -tAc \
  "SELECT 1 FROM pg_database WHERE datname='evo_${SLUG}'" 2>/dev/null || echo "")
if [ "$DB_EXISTS" = "1" ]; then
  fail "Database 'evo_${SLUG}' já existe no Postgres. Escolha outro slug ou faça drop manual."
fi

ok "Slug '$SLUG' validado e livre"

# === CÁLCULO DE PORTA ===
section "Calculando porta livre"

# Procura portas já usadas por containers evo_*
USED_PORTS=$(docker ps -a --filter "name=evo_" --format '{{.Names}}' | \
  while read name; do
    [ -z "$name" ] && continue
    docker port "$name" 2>/dev/null | grep -oE '0.0.0.0:[0-9]+' | cut -d: -f2
  done | sort -un)

# Encontra próxima livre
PORT=""
for p in $(seq "$EVOLUTION_PORT_BASE" "$MAX_PORT"); do
  if ! echo "$USED_PORTS" | grep -qx "$p" && ! ss -ltn 2>/dev/null | grep -qE ":${p}\s"; then
    PORT=$p
    break
  fi
done
[ -z "$PORT" ] && fail "Não encontrei porta livre entre $EVOLUTION_PORT_BASE e $MAX_PORT"

ok "Porta escolhida: $PORT"

# === GERAR CHAVE ===
section "Gerando API key"

API_KEY=$(openssl rand -hex 24)
ok "API key gerada (24 bytes hex = 48 chars)"

# === PEGAR SENHA DO POSTGRES ===
section "Obtendo credenciais do Postgres"

# Tenta via env do container (caso tenha sido passada)
PG_PASS=$(docker exec "$POSTGRES_CONTAINER" printenv POSTGRES_PASSWORD 2>/dev/null || echo "")

# Fallback: lê do .env do projeto
if [ -z "$PG_PASS" ]; then
  ENV_FILE=""
  for candidate in /opt/evosync/infra/evolution/.env ./infra/evolution/.env \
                   /opt/evosync/evosync-web/.env ./evosync-web/.env; do
    if [ -f "$candidate" ]; then
      ENV_FILE="$candidate"
      break
    fi
  done
  if [ -n "$ENV_FILE" ]; then
    PG_PASS=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2- || echo "")
  fi
fi

[ -z "$PG_PASS" ] && fail \
  "Não consegui descobrir a senha do Postgres.\n   Defina POSTGRES_PASSWORD como env var ou garanta que está em /opt/evosync/infra/evolution/.env"
ok "Senha do Postgres obtida"

# === CRIAR DATABASE ===
section "Criando database no Postgres"

docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -c \
  "CREATE DATABASE evo_${SLUG};" 2>&1 | grep -v "^CREATE DATABASE" || true
ok "Database 'evo_${SLUG}' criado"

# === SUBIR CONTAINER EVOLUTION ===
section "Subindo container Evolution"

docker run -d \
  --name "evo_${SLUG}" \
  --network "$EVOLUTION_NETWORK" \
  --restart unless-stopped \
  -p "${PORT}:8080" \
  -e SERVER_URL="http://localhost:${PORT}" \
  -e AUTHENTICATION_API_KEY="${API_KEY}" \
  -e DATABASE_ENABLED=true \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI="postgresql://${POSTGRES_USER}:${PG_PASS}@postgres:5432/evo_${SLUG}" \
  -e DATABASE_SAVE_DATA_INSTANCE=true \
  -e DATABASE_SAVE_DATA_NEW_MESSAGE=true \
  -e DATABASE_SAVE_MESSAGE_UPDATE=true \
  -e DATABASE_SAVE_DATA_CONTACTS=true \
  -e DATABASE_SAVE_DATA_CHATS=true \
  -e DATABASE_SAVE_DATA_LABELS=true \
  -e DATABASE_SAVE_DATA_HISTORIC=true \
  -e CACHE_REDIS_ENABLED=true \
  -e CACHE_REDIS_URI="redis://redis:6379/1" \
  -e CACHE_REDIS_PREFIX_KEY="evo_${SLUG}_v2" \
  -v "evo_${SLUG}_instances:/evolution/instances" \
  "$EVOLUTION_IMAGE" >/dev/null

ok "Container 'evo_${SLUG}' iniciado"

# === AGUARDAR INICIALIZAÇÃO ===
info "Aguardando container inicializar (15s)..."
sleep 15

# === TESTAR CONEXÃO ===
section "Validando conexão"

if curl -sf -m 10 "http://localhost:${PORT}/" \
   -H "apikey: ${API_KEY}" -o /dev/null; then
  ok "Evolution respondendo OK em http://localhost:${PORT}/"
else
  warn "Evolution pode estar inicializando ainda."
  printf '  Verifique com: %sdocker logs --tail 30 evo_%s%s\n' \
    "$C_DIM" "$SLUG" "$C_RESET"
fi

# === SUBDOMÍNIO + TLS (OPCIONAL) ===
DOMAIN=""
if [ "$NO_DOMAIN" = "0" ]; then
  section "Configurando subdomínio + TLS"
  
  if ! command -v certbot >/dev/null 2>&1; then
    warn "certbot não encontrado. Pulando TLS (use --no-domain pra suprimir este aviso)."
    NO_DOMAIN=1
  fi
  
  if [ "$NO_DOMAIN" = "0" ]; then
    DOMAIN="${EVOLUTION_DOMAIN_PREFIX}-${SLUG}.${DOMAIN_BASE}"
    
    info "Vhost nginx para ${DOMAIN}..."
    cat > "${NGINX_SITES_AVAILABLE}/evo-${SLUG}" <<NGINX_EOF
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 50M;

  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }
}
NGINX_EOF
    
    ln -sf "${NGINX_SITES_AVAILABLE}/evo-${SLUG}" "${NGINX_SITES_ENABLED}/"
    
    if nginx -t 2>/dev/null && systemctl reload nginx; then
      ok "Vhost nginx criado"
    else
      warn "Falha no nginx. Verifique: nginx -t"
    fi
    
    info "Obtendo certificado TLS via certbot..."
    if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
         -m "${EMAIL_ADMIN}" 2>&1 | tail -5; then
      ok "TLS configurado para ${DOMAIN}"
    else
      warn "certbot falhou (DNS não propagado?). Rode depois: certbot --nginx -d ${DOMAIN}"
    fi
  fi
else
  info "Subdomínio pulado (--no-domain)"
fi

# === SALVAR MAPEAMENTO ===
if [ "$NO_LOG" = "0" ]; then
  TS=$(date -Iseconds 2>/dev/null || date)
  {
    echo "=========================================="
    echo "Data:    $TS"
    echo "Slug:    $SLUG"
    echo "Porta:   $PORT"
    echo "Domain:  ${DOMAIN:-<sem subdomínio>}"
    echo "API Key: $API_KEY"
    echo "DB:      evo_${SLUG}"
    echo "Container: evo_${SLUG}"
    echo ""
  } >> "$KEYS_LOG"
  chmod 600 "$KEYS_LOG" 2>/dev/null || true
  ok "Mapeamento salvo em ${KEYS_LOG}"
fi

# === RESUMO FINAL ===
FINAL_URL="${DOMAIN:-http://${SERVER_IP:-SEU-VPS}:${PORT}}"

cat <<EOF

${C_BOLD}===============================================================${C_RESET}
${C_GREEN}  ✅ Tenant '${SLUG}' provisionado com sucesso!${C_RESET}
${C_BOLD}===============================================================${C_RESET}

  ${C_BOLD}URL:${C_RESET}        ${FINAL_URL}
  ${C_BOLD}API Key:${C_RESET}    ${API_KEY}
  ${C_BOLD}Porta:${C_RESET}      ${PORT}
  ${C_BOLD}Database:${C_RESET}   evo_${SLUG}
  ${C_BOLD}Container:${C_RESET}  evo_${SLUG}
  ${C_BOLD}Mapeamento:${C_RESET} ${KEYS_LOG}

${C_BOLD}Próximos passos:${C_RESET}

  1. Crie o tenant no EvoSync admin:
     ${C_DIM}POST /api/admin/tenants { name: "...", slug: "${SLUG}" }${C_RESET}
     ${C_DIM}(ou use a UI: /admin/tenants → "Nova empresa")${C_RESET}

  2. Emita o invite pro cliente:
     ${C_DIM}POST /api/admin/invites { tenantId, email, role: "owner" }${C_RESET}
     ${C_DIM}(ou use a UI: /admin/invites)${C_RESET}

  3. Mande pro cliente (via WhatsApp/e-mail):

     ${C_DIM}Olá! Seu EvoSync está pronto.${C_RESET}
     ${C_DIM}Link do convite: <LINK_INVITE>${C_RESET}
     ${C_DIM}URL do sistema: https://app.${DOMAIN_BASE}${C_RESET}
     ${C_DIM}URL da Evolution: ${FINAL_URL}${C_RESET}
     ${C_DIM}API Key: ${API_KEY}${C_RESET}
     ${C_DIM}(cole na aba Conexão do EvoSync)${C_RESET}

${C_DIM}Dica: o cliente escaneia o QR do WhatsApp na aba Conexão.${C_RESET}
${C_BOLD}===============================================================${C_RESET}

EOF
