#!/usr/bin/env bash
# =============================================================================
# EvoSync — setup_central_evo.sh
#
# Sobe 1 instância da Evolution API (multi-instance) na mesma VPS do EvoSync
# web, para servir TODOS os tenants no modo "managed" (Fase B).
#
# Diferente do onboard-tenant.sh (1 container por tenant), aqui temos
# 1 container só que cria N instâncias lógicas via POST /instance/create.
#
# Uso:
#   bash installer/setup_central_evo.sh                  # install completo
#   bash installer/setup_central_evo.sh --reset-key      # regenera API key
#   bash installer/setup_central_evo.sh --status         # só checa status
#   bash installer/setup_central_evo.sh --uninstall      # para e remove
#
# Pré-requisitos:
#   - EvoSync web já instalado (install_vps.sh)
#   - Docker rodando
#   - Nginx já configurado pelo install_vps.sh
#
# Idempotente: rodar 2x não quebra nada. O --reset-key é a única operação
# destrutiva (gera nova chave e exige reconfigurar tenants managed).
# =============================================================================

set -euo pipefail

# === CONFIGURAÇÃO ===
APP_DIR="/opt/evosync"
EVO_DIR="$APP_DIR/infra/evolution"
EVO_ENV_FILE="$EVO_DIR/.env"
APP_ENV_FILE="$APP_DIR/.env"
COMPOSE_FILE="$EVO_DIR/compose.yaml"
EVO_PORT="${EVO_PORT:-8080}"
EVO_IMAGE="${EVO_IMAGE:-evoapicloud/evolution-api:latest}"
SERVER_URL_DEFAULT="http://localhost:${EVO_PORT}"
ACTION="install"
RESET_KEY=0

# === CORES ===
if [ -t 1 ]; then
  C_BOLD="\033[1m"; C_DIM="\033[2m"; C_RED="\033[31m"
  C_GREEN="\033[32m"; C_YELLOW="\033[33m"; C_BLUE="\033[34m"
  C_RESET="\033[0m"
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""
  C_YELLOW=""; C_BLUE=""; C_RESET=""
fi

info()    { printf '\n%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$1"; }
ok()      { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
warn()    { printf '\n%s⚠%s  %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
fail()    { printf '\n%s✗ ERRO:%s %s\n\n' "$C_RED" "$C_RESET" "$1" >&2; exit 1; }
section() { printf '\n%s── %s ──%s\n' "$C_BOLD" "$1" "$C_RESET"; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 não encontrado."
}

usage() {
  cat <<EOF
Uso: bash $0 [flags]

Flags:
  --reset-key     Regenera AUTHENTICATION_API_KEY (destrutivo, requer reconfigurar tenants)
  --status        Só mostra status atual e sai
  --uninstall     Para e remove o container + dados (CUIDADO)
  --port N        Porta da Evolution (default: 8080)
  -h, --help      Mostrar esta ajuda

Variáveis de ambiente (opcional):
  EVO_PORT        Porta da Evolution (default: 8080)
  EVO_IMAGE       Imagem Docker (default: evoapicloud/evolution-api:latest)
EOF
}

# === PARSE DE ARGUMENTOS ===
for arg in "$@"; do
  case "$arg" in
    --reset-key) RESET_KEY=1; ACTION="reset-key" ;;
    --status) ACTION="status" ;;
    --uninstall) ACTION="uninstall" ;;
    --port) EVO_PORT="${2:-8080}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Argumento inválido: $arg" ;;
  esac
  shift
done

# === HELPERS ESPECÍFICOS ===

# Lê ou gera um valor no .env da Evolution
evo_env_get() {
  local key="$1"
  if [ -f "$EVO_ENV_FILE" ]; then
    grep "^${key}=" "$EVO_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo ""
  else
    echo ""
  fi
}

evo_env_set() {
  local key="$1"
  local val="$2"
  mkdir -p "$EVO_DIR"
  touch "$EVO_ENV_FILE"
  chmod 600 "$EVO_ENV_FILE"
  # Remove linha existente
  if grep -q "^${key}=" "$EVO_ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$EVO_ENV_FILE"
  else
    printf '%s="%s"\n' "$key" "$val" >> "$EVO_ENV_FILE"
  fi
}

# Lê ou define variável no .env do app (EvoSync web)
app_env_set() {
  local key="$1"
  local val="$2"
  if [ ! -f "$APP_ENV_FILE" ]; then
    warn "$APP_ENV_FILE não existe. Pulei $key."
    return 0
  fi
  if grep -q "^${key}=" "$APP_ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=\"${val}\"|" "$APP_ENV_FILE"
  else
    printf '\n%s="%s"\n' "$key" "$val" >> "$APP_ENV_FILE"
  fi
  chmod 600 "$APP_ENV_FILE"
}

# === STATUS ===
cmd_status() {
  section "Status do Managed Central"
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker não instalado"
  fi
  if [ ! -d "$EVO_DIR" ]; then
    fail "$EVO_DIR não existe. Rode install primeiro."
  fi
  if [ -f "$EVO_ENV_FILE" ]; then
    local api_key
    api_key=$(evo_env_get "AUTHENTICATION_API_KEY")
    if [ -z "$api_key" ]; then
      api_key=$(evo_env_get "AUTHENTICATION_APIKEY")
    fi
    if [ -n "$api_key" ]; then
      ok "AUTHENTICATION_API_KEY definida (${#api_key} chars)"
    else
      warn "AUTHENTICATION_API_KEY NÃO definida em $EVO_ENV_FILE"
    fi
  else
    warn "$EVO_ENV_FILE não existe"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE "evolution|disparofacil_evolution"; then
    ok "Container Evolution está rodando"
    docker ps --filter "name=evolution" --filter "name=disparofacil_evolution" \
      --format "    {{.Names}} | {{.Status}} | {{.Ports}}" 2>/dev/null
    echo ""
    info "Health check:"
    if curl -sf -m 5 -H "apikey: $(evo_env_get AUTHENTICATION_API_KEY || evo_env_get AUTHENTICATION_APIKEY)" \
         "http://localhost:${EVO_PORT}/" 2>/dev/null | head -c 200; then
      echo ""
      ok "API respondendo"
    else
      warn "API não respondeu em http://localhost:${EVO_PORT}/"
    fi
  else
    warn "Container Evolution NÃO está rodando"
    info "Inicie com: cd $EVO_DIR && docker compose up -d"
  fi
  echo ""
  if [ -f "$APP_ENV_FILE" ]; then
    info "Variáveis no .env do EvoSync web:"
    grep -E "^EVOLUTION_CENTRAL_" "$APP_ENV_FILE" 2>/dev/null | sed 's/^/    /' || echo "    (nenhuma)"
  fi
}

# === UNINSTALL ===
cmd_uninstall() {
  section "Removendo Managed Central"
  if [ ! -d "$EVO_DIR" ]; then
    warn "$EVO_DIR não existe. Nada a fazer."
    return 0
  fi
  warn "Isso vai parar e remover o container da Evolution + volumes."
  warn "Tenants managed ficarão quebrados (instance_state = not_found)."
  printf '   Continuar? (digite "sim" pra confirmar): '
  read -r ans
  [ "$ans" = "sim" ] || fail "Cancelado pelo usuário"
  cd "$EVO_DIR"
  docker compose down -v 2>/dev/null || true
  ok "Stack removida"
  warn "Remova manualmente: rm -rf $EVO_DIR"
}

# === INSTALL ===
cmd_install() {
  section "Validações iniciais"

  [ "$(id -u)" = "0" ] || fail "Rode como root (sudo bash $0)"

  require_command docker
  require_command curl
  require_command openssl

  if ! docker info >/dev/null 2>&1; then
    fail "Docker não está respondendo."
  fi
  ok "Docker OK"

  if [ ! -d "$APP_DIR" ]; then
    fail "$APP_DIR não existe. Rode install_vps.sh primeiro."
  fi
  ok "EvoSync web instalado em $APP_DIR"

  if [ ! -f "$APP_ENV_FILE" ]; then
    fail "$APP_ENV_FILE não existe. EvoSync web não está configurado."
  fi
  ok ".env do EvoSync web encontrado"

  # === Prepara diretório ===
  section "Preparando $EVO_DIR"
  mkdir -p "$EVO_DIR"
  ok "Diretório pronto"

  # === Copia compose.yaml do repo (se não existir) ===
  if [ ! -f "$COMPOSE_FILE" ]; then
    info "Copiando compose.yaml do repo..."
    REPO_COMPOSE="$APP_DIR/infra/evolution/compose.yaml"
    if [ ! -f "$REPO_COMPOSE" ]; then
      fail "compose.yaml não encontrado no repo ($REPO_COMPOSE)."
    fi
    cp "$REPO_COMPOSE" "$COMPOSE_FILE"
    ok "compose.yaml copiado"
  else
    ok "compose.yaml já existe, mantendo"
  fi

  # === Gera/preserva .env da Evolution ===
  section "Configurando .env da Evolution"

  local pg_pass
  pg_pass=$(evo_env_get "POSTGRES_PASSWORD")
  if [ -z "$pg_pass" ]; then
    pg_pass=$(openssl rand -hex 16)
    evo_env_set "POSTGRES_PASSWORD" "$pg_pass"
    ok "POSTGRES_PASSWORD gerado (32 hex chars)"
  else
    ok "POSTGRES_PASSWORD preservado"
  fi

  local api_key
  api_key=$(evo_env_get "AUTHENTICATION_API_KEY")
  if [ -z "$api_key" ]; then
    api_key=$(evo_env_get "AUTHENTICATION_APIKEY")
  fi
  if [ "$RESET_KEY" = "1" ] || [ -z "$api_key" ]; then
    api_key=$(openssl rand -hex 32)
    evo_env_set "AUTHENTICATION_API_KEY" "$api_key"
    # legado — remover em versões futuras
    evo_env_set "AUTHENTICATION_APIKEY" "$api_key"
    if [ "$RESET_KEY" = "1" ]; then
      ok "AUTHENTICATION_API_KEY regenerada (--reset-key)"
      warn "ATENÇÃO: tenants managed precisarão ser reprovisionados."
    else
      ok "AUTHENTICATION_API_KEY gerada (64 hex chars)"
    fi
  else
    evo_env_set "AUTHENTICATION_API_KEY" "$api_key"
    ok "AUTHENTICATION_API_KEY preservada"
  fi

  evo_env_set "EVOLUTION_PORT" "$EVO_PORT"
  evo_env_set "SERVER_URL" "$SERVER_URL_DEFAULT"
  evo_env_set "POSTGRES_DATABASE" "evolution"
  evo_env_set "POSTGRES_USERNAME" "evolution"
  ok ".env da Evolution pronto em $EVO_ENV_FILE (chmod 600)"

  # === Sobe o stack ===
  section "Subindo containers"
  cd "$EVO_DIR"
  docker compose up -d

  info "Aguardando inicialização (10s)..."
  sleep 10

  # === Health check ===
  section "Validando API"
  if curl -sf -m 10 -H "apikey: $api_key" "http://localhost:${EVO_PORT}/" -o /dev/null; then
    ok "Evolution API respondendo em http://localhost:${EVO_PORT}/"
  else
    warn "API não respondeu ainda. Verifique: docker logs \$(docker ps -qf name=evolution)"
  fi

  # === Configura nginx (location /evo/) ===
  section "Configurando nginx location /evo/"
  local NGINX_SITE="/etc/nginx/sites-available/evosync"
  if [ -f "$NGINX_SITE" ]; then
    if ! grep -q "location /evo/" "$NGINX_SITE"; then
      info "Adicionando location /evo/ no vhost do EvoSync..."
      # Insere antes do bloco "location / {"
      cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date +%s)"
      python3 -c "
import re
with open('$NGINX_SITE') as f:
    s = f.read()
block = '''
  # Managed central (Fase B) — proxy pra Evolution API
  location /evo/ {
    proxy_pass http://127.0.0.1:${EVO_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_read_timeout 3600s;
    client_max_body_size 50M;
  }

'''
s = s.replace('  # app principal', block + '  # app principal', 1)
with open('$NGINX_SITE', 'w') as f:
    f.write(s)
print('OK')
"
      if nginx -t 2>/dev/null && systemctl reload nginx; then
        ok "Nginx recarregado com /evo/"
      else
        warn "Falha no nginx. Backup salvo em ${NGINX_SITE}.bak.*"
        warn "Rode: nginx -t"
      fi
    else
      ok "location /evo/ já existe, pulando"
    fi
  else
    warn "$NGINX_SITE não encontrado. Você usa --skip-nginx? Configure manualmente."
    info "Adicione ao seu vhost:"
    cat <<NGINX_HINT

  location /evo/ {
    proxy_pass http://127.0.0.1:${EVO_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
  }
NGINX_HINT
  fi

  # === Configura .env do EvoSync web ===
  section "Configurando .env do EvoSync web"
  app_env_set "EVOLUTION_CENTRAL_URL" "http://127.0.0.1:${EVO_PORT}"
  app_env_set "EVOLUTION_CENTRAL_APIKEY" "$api_key"
  ok "EVOLUTION_CENTRAL_URL e EVOLUTION_CENTRAL_APIKEY gravadas em $APP_ENV_FILE"

  # === Resumo ===
  cat <<EOF

${C_BOLD}===============================================================${C_RESET}
${C_GREEN}  ✅ Managed Central configurado!${C_RESET}
${C_BOLD}===============================================================${C_RESET}

  ${C_BOLD}Container:${C_RESET}     docker ps | grep evolution
  ${C_BOLD}API local:${C_RESET}     http://localhost:${EVO_PORT}/
  ${C_BOLD}API key:${C_RESET}       ${api_key:0:8}...${api_key: -8}  (em $EVO_ENV_FILE, chmod 600)
  ${C_BOLD}Nginx path:${C_RESET}    /evo/ → 127.0.0.1:${EVO_PORT}/
  ${C_BOLD}EvoSync env:${C_RESET}   EVOLUTION_CENTRAL_URL + EVOLUTION_CENTRAL_APIKEY

${C_BOLD}Próximos passos:${C_RESET}

  1. Reinicie o EvoSync web pra carregar as novas env vars:
     ${C_DIM}sudo systemctl restart evosync${C_RESET}

  2. No admin (/admin/tenants → Nova empresa), selecione
     ${C_BOLD}"Managed (hospedagem centralizada)"${C_RESET} no modo de conexão.

  3. O tenant será redirecionado pra aba Conexão com QR code.

${C_BOLD}Comandos úteis:${C_RESET}

  Status:     ${C_DIM}bash $0 --status${C_RESET}
  Reset key:  ${C_DIM}bash $0 --reset-key${C_RESET}  (regenera + requer reprovisionar)
  Uninstall:  ${C_DIM}bash $0 --uninstall${C_RESET}  (para e remove tudo)

${C_BOLD}===============================================================${C_RESET}

EOF
}

# === DISPATCH ===
case "$ACTION" in
  install) cmd_install ;;
  reset-key) cmd_install ;;
  status) cmd_status ;;
  uninstall) cmd_uninstall ;;
esac
