# Deploy EvoSync em VPS (Ubuntu 24.04)

Guia para colocar o EvoSync em produção num VPS limpo.

## Pré-requisitos

- **VPS:** Ubuntu 24.04 LTS, mínimo 1 GB RAM, 2 vCPU (recomendado 2 GB)
- **Domínio:** apontando (registro A ou AAAA) para o IP público do VPS
- **Acesso:** SSH como root (ou usuário com sudo)
- **Portas liberadas no provider:** 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Install em 1 comando

```bash
# SSH no VPS
ssh root@SEU_IP

# Baixar e rodar
curl -fsSL https://raw.githubusercontent.com/arasakalab/evosync/main/installer/install_vps.sh | \
  DOMAIN=app.evosync.com.br bash
```

O script:
1. Atualiza apt e instala dependências (Node 20, nginx, certbot, sqlite3, ufw)
2. Cria usuário `evosync` (system, sem shell)
3. Clona o repo em `/opt/evosync`
4. Roda `npm ci --omit=dev` + `next build`
5. Gera `/opt/evosync/.env` com `ENCRYPTION_KEY` e `AUTH_SECRET` novos
6. Instala unit systemd `evosync.service` (auto-restart, hardened)
7. Configura nginx reverse proxy + WebSocket upgrade
8. Roda `certbot --nginx` para TLS (Let's Encrypt)
9. Cria cron diário de backup SQLite em `/var/backups/evosync`
10. Habilita ufw (SSH + Nginx Full)

## Pós-install

### 1. Configure o Evolution API do primeiro tenant

Edite `/opt/evosync/.env` e adicione as 3 vars de EVO_* :

```bash
sudo nano /opt/evosync/.env
```

```env
EVO_URL=https://evolution.exemplo.com
EVO_APIKEY=abc123...
EVO_INSTANCE=minha-instancia
```

Reinicie:

```bash
sudo systemctl restart evosync
```

### 2. Crie o super_admin

```bash
cd /opt/evosync/evosync-web
sudo -u evosync npx tsx scripts/seed-admin.ts
```

Acesse `https://app.evosync.com.br/admin/login`.

### 3. Crie o primeiro tenant + invite

1. Login como super_admin
2. Vá em `/admin/tenants` → "Nova empresa"
3. Selecione o tenant criado em `/admin/invites` → "Novo convite"
4. Copie o link `/invite/<token>` e envie ao operador

## Operações do dia-a-dia

```bash
# Status
sudo systemctl status evosync

# Logs em tempo real
sudo journalctl -u evosync -f

# Reiniciar
sudo systemctl restart evosync

# Parar
sudo systemctl stop evosync

# Health check
curl -s https://app.evosync.com.br/api/health | jq
```

## Update para nova versão

```bash
# No VPS
cd /opt/evosync
sudo bash installer/install_vps.sh --update
```

Isso faz: `git pull` → `npm ci` → `next build` → `systemctl restart evosync`.

## Backup

Backup automático diário do SQLite em `/var/backups/evosync/`, retenção 7 dias.

Para restaurar:

```bash
# Pare o serviço
sudo systemctl stop evosync

# Faça backup do estado atual (caso precise)
sudo cp /opt/evosync/evosync-web/data/evosync.db /tmp/evosync-antes-restore.db

# Restaure
sudo cp /var/backups/evosync/evosync-2026-06-12-0300.db \
        /opt/evosync/evosync-web/data/evosync.db
sudo chown evosync:evosync /opt/evosync/evosync-web/data/evosync.db

# Suba
sudo systemctl start evosync
```

## Troubleshooting

### `certbot falhou`
DNS não propagou. Verifique:
```bash
dig +short app.evosync.com.br
```
Aguarde propagar (até 48h) e rode:
```bash
sudo certbot --nginx -d app.evosync.com.br -d www.app.evosync.com.br
```

### `evosync.service failed`
```bash
sudo journalctl -u evosync -n 100 --no-pager
```

### `port 3000 already in use`
```bash
sudo lsof -i :3000
# Mate o processo
sudo kill -9 <PID>
sudo systemctl restart evosync
```

### Disco cheio (backups)
```bash
du -sh /var/backups/evosync/
sudo find /var/backups/evosync -name 'evosync-*.db' -mtime +3 -delete
```

### Esqueci senha do super_admin
```bash
cd /opt/evosync/evosync-web
sudo -u evosync npx tsx -e "
import { getDb, schema } from './lib/db';
import { hashPassword } from './lib/password';
import { eq } from 'drizzle-orm';
const db = getDb();
const h = await hashPassword('nova-senha-123');
db.update(schema.users).set({ passwordHash: h }).where(eq(schema.users.email, 'seu@email.com')).run();
console.log('senha resetada');
"
```

## Uninstall completo

```bash
sudo bash /opt/evosync/installer/uninstall_vps.sh
# ou com --keep-data pra preservar o SQLite
sudo bash /opt/evosync/installer/uninstall_vps.sh --keep-data
```

## Variáveis de ambiente (referência)

| Var | Obrigatória | Default | Descrição |
|---|---|---|---|
| `PORT` | não | 3000 | Porta HTTP do app |
| `NODE_ENV` | sim (prod) | development | `production` em prod |
| `DATABASE_URL` | não | `./data/evosync.db` | Caminho do SQLite |
| `LOG_LEVEL` | não | `info` | `debug`/`info`/`warn`/`error` |
| `ENCRYPTION_KEY` | **sim** | — | 64 hex chars (32 bytes) — gerado no install |
| `AUTH_SECRET` | **sim** | — | 32+ bytes base64 — gerado no install |
| `EVO_URL` | opcional* | — | URL da Evolution API |
| `EVO_APIKEY` | opcional* | — | API key da Evolution |
| `EVO_INSTANCE` | opcional* | — | Nome da instância WhatsApp |

* `EVO_*` são por-tenant (configuráveis via UI em `/admin/login` → aba Conexão). Podem ficar em branco no `.env` se o tenant for BYO.

## Hardening aplicado pela unit systemd

- `NoNewPrivileges` — sem escalação de privilégio
- `PrivateTmp` — `/tmp` isolado
- `ProtectSystem=full` — filesystem raiz read-only (exceto paths RW)
- `ProtectHome` — sem acesso a `/home`, `/root`, `/run/user`
- `ReadWritePaths` — apenas `data/`, `logs/`, `uploads/`
- `ProtectKernelTunables/Modules/ControlGroups` — sem tocar kernel
- `Restart=always` + `RestartSec=5` — auto-restart em crash

## Capacidade esperada (VPS 2 GB / 2 vCPU)

- **Por tenant:** ~50-200 envios/min (depende da Evolution API)
- **Tenants simultâneos:** 5-10 (cada um com 1 operador)
- **DB:** SQLite com WAL aguenta ~100k envios/dia
- **Memória:** ~150 MB RSS do processo Node + ~50 MB nginx + ~30 MB systemd
