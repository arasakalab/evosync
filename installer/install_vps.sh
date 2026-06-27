#!/usr/bin/env bash
# Installer idempotente do EvoSync web em Ubuntu 24.04 (LTS).
# Uso:
#   bash install_vps.sh                  # install completo (com prompts)
#   bash install_vps.sh --update         # git pull + reinicia
#   bash install_vps.sh --skip-nginx     # se já tem reverse proxy
#   bash install_vps.sh --domain X       # domínio p/ nginx/certbot
#   bash install_vps.sh --managed        # também sobe Evolution central (Fase B)
#
# Pré-requisitos: Ubuntu 24.04 limpo, acesso root, DNS apontando pro IP.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/arasakalab/evosync.git}"
APP_DIR="/opt/evosync"
APP_USER="evosync"
NODE_MAJOR_REQUIRED=20
DOMAIN="${DOMAIN:-}"
SKIP_NGINX=0
UPDATE_ONLY=0
MANAGED=0

while [ "${1:-}" != "" ]; do
  case "$1" in
    --update) UPDATE_ONLY=1 ;;
    --skip-nginx) SKIP_NGINX=1 ;;
    --domain) DOMAIN="${2:-}"; shift ;;
    --repo) REPO_URL="${2:-}"; shift ;;
    --managed) MANAGED=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Arg desconhecido: $1"; exit 1 ;;
  esac
  shift
done

log()  { printf '\n[install] %s\n' "$1"; }
fail() { printf '\n[install] ERRO: %s\n' "$1" >&2; exit 1; }

# === Update path ===
if [ "$UPDATE_ONLY" = "1" ]; then
  log "Modo update: git pull + reiniciar"
  [ -d "$APP_DIR" ] || fail "$APP_DIR não existe. Rode install sem --update primeiro."
  cd "$APP_DIR"
  sudo -u "$APP_USER" git pull --ff-only
  cd "$APP_DIR/evosync-web"
  sudo -u "$APP_USER" npm ci
  sudo -u "$APP_USER" npx next build
  systemctl restart evosync
  log "Update concluído. Status: systemctl status evosync"
  exit 0
fi

# === Verifica root ===
[ "$(id -u)" = "0" ] || fail "Rode como root (sudo bash $0)"

# === Detecta Ubuntu 24.04 ===
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || fail "Esperava Ubuntu, achei ${ID:-desconhecido}"
log "OS: ${PRETTY_NAME:-Ubuntu}"

# === apt update + deps base ===
log "apt update..."
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release ufw \
  openssl git sqlite3 \
  nginx certbot python3-certbot-nginx >/dev/null

# === Node.js (NodeSource 20 LTS) ===
if ! command -v node >/dev/null 2>&1; then
  log "Instalando Node.js ${NODE_MAJOR_REQUIRED}.x LTS..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR_REQUIRED}.x | bash -
  apt-get install -y -qq nodejs
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge "$NODE_MAJOR_REQUIRED" ] || fail "Node $NODE_MAJOR.x < ${NODE_MAJOR_REQUIRED} exigido"
log "Node $(node -v), npm $(npm -v)"

# === Usuário dedicado (sem shell, sem home interativa) ===
if ! id "$APP_USER" >/dev/null 2>&1; then
  log "Criando usuário $APP_USER..."
  useradd --system --shell /usr/sbin/nologin --home "$APP_DIR" --no-create-home "$APP_USER"
fi

# === Código-fonte ===
if [ ! -d "$APP_DIR" ]; then
  log "Clonando $REPO_URL em $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
  log "$APP_DIR já existe, pulando clone"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# === Dependências + build ===
log "npm ci..."
cd "$APP_DIR/evosync-web"
sudo -u "$APP_USER" npm ci

log "next build..."
sudo -u "$APP_USER" npx next build

# === Gera .env de produção se não existir ===
if [ ! -f "$APP_DIR/.env" ]; then
  log "Gerando /opt/evosync/.env com segredos novos..."
  ENC_KEY=$(openssl rand -hex 32)
  AUTH_SECRET=$(openssl rand -base64 32)
  cat > "$APP_DIR/.env" <<EOF
# EvoSync — produção
DATABASE_URL=./data/evosync.db
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ENCRYPTION_KEY=$ENC_KEY
AUTH_SECRET=$AUTH_SECRET
# Preencha conforme o tenant:
# EVO_URL=https://sua-evolution-api.exemplo.com
# EVO_APIKEY=...
# EVO_INSTANCE=...
EOF
  chmod 600 "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  log ".env criado com segredos. Edite $APP_DIR/.env pra adicionar EVO_URL/EVO_APIKEY."
else
  log ".env já existe, mantendo"
fi

# === Diretórios persistentes (ReadWritePaths do systemd) ===
log "Criando data/, logs/, uploads/..."
mkdir -p "$APP_DIR/evosync-web/data" "$APP_DIR/evosync-web/logs" "$APP_DIR/evosync-web/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/evosync-web/data" "$APP_DIR/evosync-web/logs" "$APP_DIR/evosync-web/uploads"

# === Systemd unit ===
log "Instalando unit systemd /etc/systemd/system/evosync.service..."
cat > /etc/systemd/system/evosync.service <<'EOF'
[Unit]
Description=EvoSync web (Next.js + Drizzle + SQLite)
After=network.target

[Service]
Type=simple
User=evosync
Group=evosync
WorkingDirectory=/opt/evosync/evosync-web
EnvironmentFile=/opt/evosync/.env
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=evosync

# Limites de recursos (ajuste conforme VPS)
LimitNOFILE=65535

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/evosync/evosync-web/data /opt/evosync/evosync-web/logs /opt/evosync/evosync-web/uploads
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable evosync.service

# === Backup do SQLite ===
log "Configurando backup diário..."
mkdir -p /var/backups/evosync
chown "$APP_USER:$APP_USER" /var/backups/evosync
cat > /etc/cron.daily/evosync-backup <<'EOF'
#!/bin/sh
set -e
DB=/opt/evosync/evosync-web/data/evosync.db
DST=/var/backups/evosync
test -f "$DB" || exit 0
sqlite3 "$DB" ".backup '$DST/evosync-$(date +%F-%H%M).db'"
# rotaciona: mantém 7 diários
find "$DST" -name 'evosync-*.db' -mtime +7 -delete
EOF
chmod +x /etc/cron.daily/evosync-backup
log "Backup em /var/backups/evosync (retenção 7 dias)"

# === Nginx (opcional) ===
if [ "$SKIP_NGINX" = "0" ]; then
  if [ -z "$DOMAIN" ]; then
    read -rp "Domínio para nginx/certbot (ex: app.evosync.com.br, vazio = pular): " DOMAIN
  fi
  if [ -n "$DOMAIN" ]; then
    log "Configurando nginx para $DOMAIN..."
    cat > /etc/nginx/sites-available/evosync <<EOF
# EvoSync — reverse proxy
upstream evosync_upstream {
  server 127.0.0.1:3000;
  keepalive 32;
}

server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;
  server_tokens off;
  client_max_body_size 50M;

  # logs
  access_log /var/log/nginx/evosync.access.log;
  error_log  /var/log/nginx/evosync.error.log;

  # health check (sem auth, sem rate limit)
  location = /api/health {
    proxy_pass http://evosync_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    access_log off;
  }

  # WebSocket upgrade
  location /ws {
    proxy_pass http://evosync_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
  }

  # app principal
  location / {
    proxy_pass http://evosync_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
    proxy_buffering off;
  }
}
EOF
    ln -sf /etc/nginx/sites-available/evosync /etc/nginx/sites-enabled/evosync
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    log "Nginx configurado. Validando TLS com certbot..."
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || \
      log "certbot falhou (provavelmente DNS não propagado). Rode: certbot --nginx -d $DOMAIN"
  else
    log "Sem domínio, pulando nginx/certbot"
  fi
fi

# === Firewall ===
if command -v ufw >/dev/null 2>&1; then
  log "Configurando ufw..."
  ufw allow OpenSSH >/dev/null 2>&1 || true
  if [ "$SKIP_NGINX" = "0" ] && [ -n "$DOMAIN" ]; then
    ufw allow 'Nginx Full' >/dev/null 2>&1 || true
  fi
  # ufw enable é interativo; descomente a próxima linha se quiser forçar:
  # ufw --force enable
fi

# === Inicia o serviço ===
log "Iniciando evosync.service..."
systemctl restart evosync.service
sleep 3
systemctl is-active evosync.service && log "✓ evosync está rodando" || {
  log "✗ evosync falhou ao iniciar. Verifique: journalctl -u evosync -n 50"
  exit 1
}

cat <<EOF

===============================================================
  EvoSync instalado com sucesso!
===============================================================

  Pasta:        $APP_DIR
  Logs:         journalctl -u evosync -f
  Status:       systemctl status evosync
  Health check: curl http://localhost:3000/api/health
  Backup:       /var/backups/evosync/ (cron diário, 7 dias)

  Próximos passos:
  1. Edite $APP_DIR/.env e defina EVO_URL/EVO_APIKEY (se for usar envio)
  2. Acesse http${DOMAIN:+s}://${DOMAIN:-localhost:3000}/admin/login
  3. Crie o primeiro super_admin:
     cd $APP_DIR/evosync-web && sudo -u evosync npx tsx scripts/seed-admin.ts

EOF

# === Managed central (Fase B) ===
# Se --managed foi passado OU se o usuário aceitar prompt, roda setup_central_evo.sh
RUN_MANAGED="$MANAGED"
if [ "$RUN_MANAGED" = "0" ] && [ -t 0 ]; then
  printf '%s' "Subir Evolution API centralizada (modo managed, Fase B)? (y/N): "
  read -r ans
  case "${ans:-N}" in
    y|Y|yes|YES) RUN_MANAGED=1 ;;
  esac
fi
if [ "$RUN_MANAGED" = "1" ]; then
  log "Subindo Managed Central..."
  if [ -f "$APP_DIR/installer/setup_central_evo.sh" ]; then
    bash "$APP_DIR/installer/setup_central_evo.sh"
  else
    log "setup_central_evo.sh não encontrado em $APP_DIR/installer/. Baixe o repo atualizado."
  fi
fi
