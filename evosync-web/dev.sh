#!/usr/bin/env bash
# Gerencia o ciclo de vida do EvoSync web (dev/prod) em background.
# Uso:
#   bash dev.sh start    # build de produção + inicia
#   bash dev.sh dev      # dev mode (tsx watch) com hot reload
#   bash dev.sh stop     # para o servidor
#   bash dev.sh status   # mostra status + log
#   bash dev.sh restart  # para e inicia
#   bash dev.sh logs     # tail -f do log
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/logs/server.pid"
LOG_FILE="$ROOT_DIR/logs/server.log"
PORT="${PORT:-3000}"

mkdir -p "$ROOT_DIR/logs"

start_prod() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" | awk '{print $2}')" 2>/dev/null; then
    echo "[evosync-web] já está rodando (PID $(cat "$PID_FILE" | awk '{print $2}'))"
    return 0
  fi
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "[evosync-web] node_modules ausente — rodando npm install..."
    (cd "$ROOT_DIR" && npm install)
  fi
  if [ ! -d "$ROOT_DIR/.next" ]; then
    echo "[evosync-web] build ausente — gerando..."
    (cd "$ROOT_DIR" && npx next build)
  fi
  if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/../.env" ]; then
    cp "$ROOT_DIR/../.env" "$ROOT_DIR/.env" && chmod 600 "$ROOT_DIR/.env"
  fi
  echo "[evosync-web] iniciando em produção (porta $PORT)..."
  (cd "$ROOT_DIR" && NODE_ENV=production PORT="$PORT" nohup npx tsx server.ts > "$LOG_FILE" 2>&1 & echo "PID: $!" > "$PID_FILE")
  sleep 2
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" | awk '{print $2}')
    echo "[evosync-web] rodando em http://localhost:$PORT (PID $PID)"
  fi
}

start_dev() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" | awk '{print $2}')" 2>/dev/null; then
    echo "[evosync-web] já está rodando — pare antes com: bash dev.sh stop"
    return 1
  fi
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    (cd "$ROOT_DIR" && npm install)
  fi
  echo "[evosync-web] iniciando em dev mode (hot reload)..."
  (cd "$ROOT_DIR" && PORT="$PORT" nohup npx tsx watch server.ts > "$LOG_FILE" 2>&1 & echo "PID: $!" > "$PID_FILE")
  sleep 3
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE" | awk '{print $2}')
    echo "[evosync-web] dev mode em http://localhost:$PORT (PID $PID)"
  fi
}

stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "[evosync-web] não está rodando"
    return 0
  fi
  PID=$(cat "$PID_FILE" | awk '{print $2}')
  if kill -0 "$PID" 2>/dev/null; then
    echo "[evosync-web] parando PID $PID..."
    kill -INT "$PID" 2>/dev/null || true
    for i in 1 2 3 4 5; do
      sleep 1
      kill -0 "$PID" 2>/dev/null || break
    done
    if kill -0 "$PID" 2>/dev/null; then
      echo "[evosync-web] forçando kill -9..."
      kill -9 "$PID" 2>/dev/null || true
    fi
    # mata filhos remanescentes (worker_threads do SenderWorker)
    pkill -P "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "[evosync-web] parado"
}

status() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" | awk '{print $2}')" 2>/dev/null; then
    PID=$(cat "$PID_FILE" | awk '{print $2}')
    echo "[evosync-web] RODANDO (PID $PID, porta $PORT)"
    if command -v ss >/dev/null 2>&1; then
      ss -ltnp 2>/dev/null | grep ":$PORT" || true
    fi
  else
    echo "[evosync-web] PARADO"
  fi
  echo
  echo "--- últimas 20 linhas de $LOG_FILE ---"
  tail -20 "$LOG_FILE" 2>/dev/null || echo "(sem log)"
}

case "${1:-status}" in
  start)  start_prod ;;
  dev)    start_dev ;;
  stop)   stop ;;
  status) status ;;
  restart) stop; start_prod ;;
  logs)   tail -f "$LOG_FILE" ;;
  *)
    echo "Uso: $0 {start|dev|stop|status|restart|logs}"
    exit 1
    ;;
esac
