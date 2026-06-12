#!/usr/bin/env bash
# Remove a instalação do EvoSync. Útil pra re-install limpo ou migração.
# NÃO remove /var/backups/evosync (dados) — faça manualmente se quiser.
set -euo pipefail

APP_DIR="/opt/evosync"
APP_USER="evosync"

[ "$(id -u)" = "0" ] || { echo "Rode como root (sudo $0)"; exit 1; }

if systemctl is-active evosync.service >/dev/null 2>&1; then
  echo "[uninstall] parando evosync.service"
  systemctl stop evosync.service
fi
if systemctl is-enabled evosync.service >/dev/null 2>&1; then
  systemctl disable evosync.service
fi

rm -f /etc/systemd/system/evosync.service
rm -f /etc/cron.daily/evosync-backup
rm -f /etc/nginx/sites-enabled/evosync
rm -f /etc/nginx/sites-available/evosync

if [ -d "$APP_DIR" ]; then
  echo "[uninstall] removendo $APP_DIR (use --keep-data pra preservar)"
  if [ "${1:-}" = "--keep-data" ]; then
    mv "$APP_DIR/evosync-web/data" "/tmp/evosync-data-$(date +%s)"
    echo "  dados movidos pra /tmp/evosync-data-*"
  fi
  rm -rf "$APP_DIR"
fi

if id "$APP_USER" >/dev/null 2>&1; then
  userdel "$APP_USER" 2>/dev/null || true
fi

systemctl daemon-reload
systemctl reload nginx 2>/dev/null || true
echo "[uninstall] ✓ concluído"
echo "  backup (se houver) ainda em /var/backups/evosync/"
