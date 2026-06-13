# Changelog

Todas as mudanças notáveis do EvoSync.

## [1.0.0] — 2026-06-12

Versão inicial SaaS multi-tenant. Migração do app desktop Python para web.

### Adicionado

**Infraestrutura**
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- SQLite + Drizzle ORM (migrations versionadas)
- AES-256-GCM para credenciais sensíveis (`lib/crypto.ts`)
- Custom server (`server.ts`) com WebSocket e scheduler loop
- WebSocket hub para updates em tempo real
- Custom `dev.sh` para start/stop/status/logs

**Autenticação & Multi-tenancy**
- NextAuth v5 com Credentials provider + bcrypt
- Sessões JWT com `tenantId`, `role` e `id` no token
- Middleware edge-safe (protege `/admin/*`)
- Route groups `(app)` vs `admin` (chrome diferente)
- Isolamento total: cada tenant só vê seus próprios dados (4 stores refatorados)
- License model: 30 dias por padrão, gerenciado pelo super_admin
- License check no layout server-side (redirect pra `/license-expired`)

**Invite flow**
- Super admin emite convite (token único, 7d expiry)
- `/invite/[token]` page com set-password
- Convite single-use, revogável, reuso bloqueado (410)
- Auto-revoke de convites pendentes anteriores pro mesmo email+tenant

**Admin Panel (super_admin only)**
- Dashboard com stats (tenants, users, licenças, convites, audit)
- `/admin/tenants` — listar, criar (auto-slug + license), suspender/ativar
- `/admin/licenses` — listar com warning de expiração, renovar
- `/admin/invites` — listar, criar, copiar link, revogar
- `/admin/users` — listar todos os usuários
- `/admin/audit` — log estruturado com filtros (tenant/user/action/date)
- Export CSV de audit (até 50k rows)
- Sidebar com badges de alerta (expiring licenses, pending invites)

**Auditoria**
- Tabela `audit_log` com 9 ações instrumentadas:
  - `auth.login.success`, `auth.login.failed` (com reason)
  - `license.extended`
  - `invite.created`, `invite.revoked`
  - `tenant.created`, `tenant.suspended`, `tenant.activated`
  - `user.created_via_invite`
- Filtros por tenant/user/action/período + paginação
- Best-effort (nunca bloqueia operação principal)

**Hardening**
- Rate limit in-memory LRU+TTL:
  - Login: 5/15min por email
  - Invite accept: 10/h por IP
  - Invite view: 30/h por IP
- Error pages: `app/error.tsx`, `not-found.tsx`, `global-error.tsx`
- Logger estruturado (pino) com redact de secrets
- Graceful shutdown: SIGTERM → scheduler stop → ws close → http close → exit
- `/api/health` endpoint (DB + scheduler liveness)

**Deploy**
- `installer/install_vps.sh` — Ubuntu 24.04 idempotente
- Systemd unit hardened (NoNewPrivileges, ProtectSystem, ReadWritePaths)
- Nginx reverse proxy + WebSocket upgrade
- Let's Encrypt via certbot --nginx
- Backup diário do SQLite em `/var/backups/evosync` (retenção 7d)
- `install_vps.sh --update` para updates incrementais
- `installer/uninstall_vps.sh` para cleanup
- `docs/DEPLOY_VPS.md` com troubleshooting completo

**Documentação**
- `README.md` — quickstart, env vars, comandos úteis
- `docs/DEPLOY_VPS.md` — deploy em produção
- `docs/SECURITY.md` — modelo de ameaças, criptografia, boas práticas
- `docs/ARCHITECTURE.md` — diagrama de componentes

### Compatibilidade

- Mantém compat com `main.py` legado (EvoTeste Python desktop)
- Não renomeia arquivos legados (`evo_client.py`, `client.py`, JSON files)
- Variáveis internas preservadas (`__evoteste_sender`, etc)
- DB path default: `./data/evosync.db` (auto-criado)
- BYO Evolution API por tenant (configurável na UI)

### Segurança

- Credenciais via env (não hardcoded)
- `ENCRYPTION_KEY` 32 bytes (64 hex chars) — gerado pelo install
- `AUTH_SECRET` 32+ bytes base64 — gerado pelo install
- `.env` com permissão 0600
- Audit log de todas ações sensíveis
- Rate limit contra brute-force
- CSRF via NextAuth
- HTTPS obrigatório em produção (certbot)
