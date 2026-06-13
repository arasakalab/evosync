# EvoSync

> Disparador em massa via Evolution API — versão web multi-tenant (SaaS)

App para envio de mensagens em massa pelo WhatsApp, usando a [Evolution API](https://github.com/EvolutionAPI/evolution-api)
como gateway. Cada cliente traz sua própria Evolution API (BYO), garantindo
isolamento total de credenciais.

## Status

**Versão 1.0.0** — SaaS production-ready.

| Fase | Status | Commit |
|---|---|---|
| 1. DB (SQLite + Drizzle + AES-256-GCM) | ✅ | `75073e7` |
| 2. Auth (NextAuth v5) | ✅ | `30f946a` |
| 3. License model | ✅ | `398ac16` |
| 4. Multi-tenant data isolation | ✅ | `487c02f` |
| 5. Invite flow | ✅ | `80d9de7` |
| 6. Admin panel | ✅ | `80d9de7` |
| 7. Audit log estruturado | ✅ | (ver `git log`) |
| 8. VPS deploy + health | ✅ | (ver `git log`) |
| 9. Hardening + docs | ✅ | (ver `git log`) |

## Quickstart (local)

```bash
# 1. Instalar dependências
cd evosync-web
npm install

# 2. Configurar .env (ou copiar .env.example e editar)
cp .env.example .env
# Edite .env: ENCRYPTION_KEY, AUTH_SECRET (gere com openssl rand)

# 3. Build + start
bash dev.sh start

# 4. Criar super_admin (seed)
npx tsx scripts/seed-admin.ts

# 5. Acessar
# http://localhost:3000/admin/login
# super_admin: desenvolvimento@arasakalab.com.br / senha-admin-123
```

## Quickstart (produção em VPS)

```bash
# No VPS Ubuntu 24.04 limpo
curl -fsSL https://raw.githubusercontent.com/arasakalab/evosync/main/installer/install_vps.sh | \
  DOMAIN=app.evosync.com.br bash
```

Ver [`docs/DEPLOY_VPS.md`](./docs/DEPLOY_VPS.md) para detalhes.

## Comandos úteis

```bash
# Dev mode (hot reload)
bash dev.sh dev

# Produção (usa .next/ build)
bash dev.sh start

# Status + últimas linhas do log
bash dev.sh status

# Tail do log
bash dev.sh logs

# Parar
bash dev.sh stop

# Reiniciar
bash dev.sh restart

# Typecheck
npm run typecheck

# Lint
npm run lint

# Build manual
npx next build
```

## Variáveis de ambiente

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | não | Caminho SQLite. Default: `./data/evosync.db` |
| `PORT` | não | Porta HTTP. Default: 3000 |
| `NODE_ENV` | sim (prod) | `production` em prod |
| `LOG_LEVEL` | não | `debug`/`info`/`warn`/`error`. Default: `info` |
| `ENCRYPTION_KEY` | **sim** | 64 hex chars (32 bytes) — gerado no install |
| `AUTH_SECRET` | **sim** | 32+ bytes base64 — gerado no install |
| `EVO_URL` | opcional* | URL da Evolution API (default por tenant) |
| `EVO_APIKEY` | opcional* | API key (default por tenant) |
| `EVO_INSTANCE` | opcional* | Nome da instância (default por tenant) |

* `EVO_*` são configuráveis por tenant na UI (aba Conexão). Use `.env` só
como default global.

## Estrutura

```
evosync-web/
├─ app/                        # Next.js App Router
│  ├─ (app)/                   # Rotas autenticadas (com AppShell)
│  ├─ admin/                   # Admin panel
│  │  ├─ login/                # Login
│  │  └─ (panel)/              # Sidebar admin (super_admin only)
│  ├─ invite/[token]/          # Aceite de convite (público)
│  ├─ license-expired/         # Bloqueio
│  ├─ api/                     # API routes
│  │  ├─ admin/                # /api/admin/* (super_admin)
│  │  ├─ auth/                 # NextAuth
│  │  ├─ contacts/             # CRUD contatos
│  │  ├─ schedules/            # CRUD agendamentos
│  │  ├─ settings/             # Config tenant
│  │  ├─ send/                 # Iniciar envio
│  │  ├─ invites/              # Accept invite
│  │  ├─ opencode/             # Geração de msg
│  │  ├─ connection/           # Test Evolution
│  │  └─ health/               # Liveness check
│  ├─ error.tsx                # Erro em rota
│  ├─ not-found.tsx            # 404
│  └─ global-error.tsx         # Erro fatal
├─ components/
│  ├─ ui/                      # shadcn/ui
│  ├─ layout/                  # AppShell, Header, Sidebar
│  └─ admin/                   # AdminShell
├─ lib/                        # Helpers (db, auth, crypto, etc)
├─ server/                     # Backend custom (sender, scheduler, ws)
│  ├─ sender/                  # Loop de envio
│  ├─ scheduler/               # Polling de agendamentos
│  ├─ ws/                      # Hub WebSocket
│  ├─ evo/                     # Cliente Evolution API
│  └─ store/                   # CRUD por domínio
├─ scripts/                    # seed-admin, migrate, seed-tenant2
├─ data/                       # SQLite DB (gitignored)
├─ logs/                       # server.log, server.pid
├─ docs/                       # DEPLOY_VPS, SECURITY, CHANGELOG, ARCHITECTURE
├─ installer (raiz)            # install_vps.sh, uninstall_vps.sh
├─ server.ts                   # Custom server entry
└─ dev.sh                      # Lifecycle manager
```

## Documentação

- [`docs/DEPLOY_VPS.md`](./docs/DEPLOY_VPS.md) — Deploy em produção
- [`docs/SECURITY.md`](./docs/SECURITY.md) — Modelo de ameaças
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — Histórico de versões
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Componentes e fluxos

## Compatibilidade com versão Python (legada)

O app Python desktop (`main.py` na raiz do repo) continua funcional
independente. Não renomeamos:

- `main.py` (mantém nome "EvoTeste")
- `evo_client.py`, `client.py`
- JSON files (`config.json`, `sent_log.json`, `persisted_contacts.json`, etc)
- Variáveis internas Python (`__evoteste_sender`, `__evoteste_loop`, `__evoteste_hub`)

Decisão: a web app é uma **evolução** da Python, não uma substituição.
Compartilham dados via SQLite no futuro (migração opcional).

## Licença

Proprietary. © 2026 ArasakaLab.
