#!/usr/bin/env bash
# Instala o CLI OpenCode e configura paths para o serviço evosync (usuário evosync, ProtectHome).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/evosync}"
APP_USER="${APP_USER:-evosync}"
BIN="/usr/local/bin/opencode"
OC_DIR="$APP_DIR/opencode"

log() { printf '\n[opencode] %s\n' "$1"; }
fail() { printf '\n[opencode] ERRO: %s\n' "$1" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "Rode como root (sudo bash $0)"
[ -d "$APP_DIR" ] || fail "$APP_DIR não encontrado"

# === Instala binário em /usr/local/bin ===
if [ ! -x "$BIN" ]; then
  log "Baixando OpenCode CLI..."
  curl -fsSL https://opencode.ai/install | bash
  SRC="${OPENCODE_INSTALL_DIR:-$HOME/.opencode/bin}/opencode"
  [ -x "$SRC" ] || SRC="$HOME/.opencode/bin/opencode"
  [ -x "$SRC" ] || fail "Instalação falhou — binário não encontrado em $HOME/.opencode/bin"
  install -m 755 "$SRC" "$BIN"
  log "OpenCode instalado em $BIN"
else
  log "OpenCode já presente em $BIN ($("$BIN" --version 2>/dev/null || echo ok))"
fi

# === Diretórios graváveis pelo usuário evosync (systemd ProtectHome) ===
log "Configurando diretórios em $OC_DIR..."
mkdir -p "$OC_DIR"/{config,data,home}
install -m 640 -o "$APP_USER" -g "$APP_USER" \
  "$APP_DIR/installer/opencode/opencode.json" "$OC_DIR/config/opencode.json"
chown -R "$APP_USER:$APP_USER" "$OC_DIR"

# === auth.json (OpenCode Zen exige credencial em data/opencode/auth.json) ===
sync_auth_json() {
  local key
  key=$(grep '^OPENCODE_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)
  [ -n "$key" ] || return 0
  mkdir -p "$OC_DIR/data/opencode"
  python3 - <<PY
import json, os
key = os.environ["KEY"]
path = os.environ["AUTH"]
data = {}
try:
    with open(path) as f:
        data = json.load(f)
except FileNotFoundError:
    pass
entry = {"type": "api", "key": key}
data["opencode"] = entry
data["zen"] = entry
with open(path, "w") as f:
    json.dump(data, f, indent=2)
os.chmod(path, 0o600)
PY
  chown -R "$APP_USER:$APP_USER" "$OC_DIR/data"
}

# === Variáveis no .env (preserva valores existentes) ===
ENV_FILE="$APP_DIR/.env"
[ -f "$ENV_FILE" ] || fail "$ENV_FILE não encontrado"

ensure_env() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    return 0
  fi
  echo "${key}=${val}" >> "$ENV_FILE"
}

ensure_env OPENCODE_BIN "$BIN"
ensure_env OPENCODE_CONFIG "$OC_DIR/config/opencode.json"
ensure_env OPENCODE_HOME "$OC_DIR/home"
ensure_env XDG_CONFIG_HOME "$OC_DIR/config"
ensure_env XDG_DATA_HOME "$OC_DIR/data"
ensure_env NVIDIA_API_KEY ""
ensure_env OPENCODE_API_KEY ""
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

KEY=$(grep '^OPENCODE_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r' || true)
if [ -n "$KEY" ]; then
  export KEY
  export AUTH="$OC_DIR/data/opencode/auth.json"
  sync_auth_json
  log "auth.json sincronizado para OpenCode Zen"
fi

# === Systemd: paths graváveis + PATH com /usr/local/bin ===
UNIT="/etc/systemd/system/evosync.service"
if [ -f "$UNIT" ]; then
  log "Atualizando unit systemd..."
  if ! grep -q "$OC_DIR" "$UNIT"; then
    sed -i "s|ReadWritePaths=\(.*\)|ReadWritePaths=\1 $OC_DIR|" "$UNIT"
  fi
  if ! grep -q '^Environment=PATH=' "$UNIT"; then
    sed -i '/^EnvironmentFile=/a Environment=PATH=/usr/local/bin:/usr/bin:/bin' "$UNIT"
  fi
  systemctl daemon-reload
fi

log "Setup concluído."
if ! grep -q '^NVIDIA_API_KEY=.\+' "$ENV_FILE" && ! grep -q '^OPENCODE_API_KEY=.\+' "$ENV_FILE"; then
  log "Próximo passo: adicione NVIDIA_API_KEY (grátis em build.nvidia.com) em $ENV_FILE"
  log "  sudo nano $ENV_FILE"
  log "  systemctl restart evosync"
fi
