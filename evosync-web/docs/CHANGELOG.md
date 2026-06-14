# Changelog

Todas as mudanças notáveis do EvoSync.

## [1.1.0] — 2026-06-14

### Contatos Organizados (ADR-001 web)

Tela de Contatos agora separa **catálogo** (todos os contatos conhecidos)
de **seleção de envio** (subconjunto marcado para o próximo disparo).
Resolve o problema "importei 500, só 80 vão para a campanha X".

#### Adicionado

**Modelo de dados**
- `Contact` ganha `id, name, tags, lists, opt_out, notes, createdAt, updatedAt` (migration `0001`).
- Tabelas novas: `contact_lists` (listas nomeadas com UNIQUE por tenant),
  `contact_list_members` (N:N com CASCADE),
  `contact_selections` (1 row por tenant, JSON array de IDs).
- `schedules.selected_contact_ids` (migration `0002`) — congela a seleção
  vigente no momento do agendamento modo `current`.

**Server (store + API)**
- `listContacts(tenantId, filters?)` com filtros SQL: `q`, `mode`, `tag`,
  `list`, `opt_out`, `limit`, `offset`. Retorna
  `{ contacts, count, filteredCount }`.
- `addContactsBulk` agora faz **upsert com merge**: preserva
  `name`/`tags`/`opt_out`/`notes`/`lists` se o caller não passou (LGPD/anti-ban).
- Funções novas: `getContact`, `updateContact`, `deleteContact`,
  `bulkSetTag`, `bulkSetOptOut`.
- `server/store/contact-lists.ts` (CRUD de listas + membership,
  sincroniza `contacts.lists` denormalizado).
- `server/store/contact-selections.ts` (get/set/bulkToggle com UPSERT).
- `lib/api-helpers.ts` (`requireTenantId`, `parseJsonBody`, `validateWith(zod)`).
- Endpoints novos: `/api/contacts/:id` (GET/PATCH/DELETE),
  `/api/contacts/bulk-select`, `/api/contacts/selection` (GET/PUT),
  `/api/contact-lists` (GET/POST), `/api/contact-lists/:id` (GET/PATCH/DELETE),
  `/api/contact-lists/:id/members` (GET/POST/DELETE).
- `POST /api/send/start` aceita `contactIds?: string[]`; backend é fonte
  da verdade, filtra via `mode: "selected"` + checagem de opt-out.

**Sender / Opt-out**
- `SenderRunner` checa `c.opt_out` antes de validar/enviar — pula
  com stage `opt_out`, incrementa `status.opt_out`.
- `SendStatus.opt_out: number` (novo).

**Frontend (Zustand + UI)**
- `lib/store.ts` estendido: `selectedIds: Set<string>`, `mode`, filtros,
  `contactLists: ContactList[]`, ações de sync com debounce 300ms.
- `lib/api.ts` com métodos novos (`selection.get/put`, `bulkSelect`,
  `contacts.get/update/remove`, `contactLists.*`).
- Componentes novos: `ContactModeToggle`, `TagChips`, `ListChips`,
  `BulkActionBar`, `OptOutBadge`, `CreateListDialog`, `AddTagDialog`.
- `app/(app)/contatos/page.tsx` reescrita: 3 modos, chips de tag/lista,
  7 colunas na tabela, contador inteligente no header, barra de ação
  em massa.
- `app/(app)/disparo/page.tsx`: envia `contactIds` no start; novo card
  "Opt-out" nos contadores.
- `app/(app)/agenda/page.tsx`: modo `current` envia `contact_ids`;
  tabela mostra contagem de `selected_contact_ids`.
- `components/layout/header.tsx`: contador "Catálogo: X · Selecionados: Y".
- `components/layout/app-shell.tsx`: hidrata contatos, listas e seleção
  no mount.

**Testes E2E (Playwright)**
- `@playwright/test` adicionado como devDep.
- `playwright.config.ts` + `scripts/seed-e2e.ts` (2 tenants isolados).
- 5 specs cobrindo: organizar (import + lista + tag + opt-out),
  persistência de seleção, view modes, isolamento UI, isolamento API.

**Documentação**
- `docs/contacts-organization.md` (ADR-001 completo).
- `README.md` atualizado (status v1.1, instruções de teste E2E).

#### Corrigido

- `Contact.id` era descartado pelo mapper em `server/store/contacts.ts` —
  agora preservado e exposto na UI.
- Reimport CSV/WA sobrescrevia silenciosamente — agora respeita o invariante
  LGPD (não reseta opt-out/tags do operador).
- `SenderRunner` não tinha mecanismo de opt-out — agora pula antes de
  validar.

#### Compatibilidade

- 2 migrations aditivas (apenas `ADD COLUMN` com default e `CREATE TABLE`).
- Sem mudança breaking em rotas existentes (apenas adições).
- Tipo `Contact` ganhou campos opcionais? Não — `id` virou obrigatório
  no mapper (sempre presente, era bug).

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
