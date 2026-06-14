---
tipo: doc
tags: [evosync, arquitetura, web]
criado: 2026-06-14
status: ativo
origem: evosync-web/docs/ARCHITECTURE.md
---

# Visão Geral — Arquitetura do EvoSync Web

> Importado de `evosync-web/docs/ARCHITECTURE.md` e indexado em [[MOC-Raiz]].
> Para o mapa de pastas completo veja [[MOC-SaaS-Web]].

## Visão geral

EvoSync é um SaaS multi-tenant construído em Next.js 14 (App Router) com SQLite
como banco de dados principal. Cada tenant roda sua própria "conta lógica" com
usuários, contatos, agendamentos e credenciais Evolution API isoladas.

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React)                                            │
│  ├─ Admin Panel (super_admin) — /admin/*                    │
│  └─ App Principal (operator) — /                            │
│       ├─ Aba Contatos                                       │
│       ├─ Aba Mensagem                                       │
│       ├─ Aba Agendamento                                    │
│       └─ Aba Conexão (Evolution API BYO)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP + WebSocket (/ws)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Custom server (server.ts)                                  │
│  ├─ Next.js request handler                                 │
│  ├─ WebSocketServer (hub) — updates em tempo real           │
│  └─ Scheduler Loop — a cada 30s, dispara agendamentos       │
└─────────────────────────────────────────────────────────────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ SQLite (WAL) │  │  Drizzle ORM    │  │ Evolution API    │
│ (data/evo.   │  │  + migrations   │  │ (por tenant,     │
│  sync.db)    │  │                 │  │  BYO)            │
└──────────────┘  └─────────────────┘  └──────────────────┘
```

## Componentes principais

### `lib/`
- `auth.ts` + `auth.config.ts` — NextAuth v5 (split edge/server)
- `db/` — Drizzle schema, migrations, cliente singleton
- `crypto.ts` — AES-256-GCM (encrypt/decrypt)
- `password.ts` — bcrypt cost 10
- `license.ts` — CRUD + check de licenças
- `rate-limit.ts` — in-memory LRU+TTL
- `logger.ts` — pino (JSON em prod, pretty em dev)
- `utils.ts` — cn(), formatadores

### `server/`
- `sender/` — runner + manager (envio de mensagens, sem worker_threads)
- `scheduler/loop.ts` — polling de 30s, dispara agendamentos
- `ws/hub.ts` — pub/sub WebSocket
- `store/` — CRUD por domínio:
  - `settings.ts` — configs do tenant (api_key encriptada)
  - `contacts.ts` — contatos + dedup
  - `schedules.ts` — agendamentos
  - `sent-log.ts` — histórico de envios (Set<string> por tenant)
  - `invites.ts` — convites
  - `audit.ts` — log de auditoria

### `app/`
- `(app)/` — route group com AppShell (header + sidebar + statusbar)
  - `/` — dashboard
  - `/contacts`, `/message`, `/schedule`, `/connection`, `/history`
- `admin/` — route group SEM AppShell
  - `/admin/login` — sem chrome
  - `/admin/(panel)/` — com sidebar admin
    - `/admin` (dashboard)
    - `/admin/tenants`, `/licenses`, `/invites`, `/users`, `/audit`
- `invite/[token]` — pública, set-password
- `license-expired` — bloqueio

### `components/`
- `ui/` — shadcn/ui primitives
- `layout/` — AppShell, Header, Sidebar, StatusBar
- `admin/` — AdminShell, LogoutButton

## Fluxos críticos

### Login

```
1. POST /api/auth/callback/credentials (form: email, password)
2. Rate limit check (5/15min por email)
3. lib/auth.authorize():
   a. SELECT user FROM users WHERE email = ?
   b. bcrypt.compare(password, user.password_hash)
   c. UPDATE last_login_at
   d. INSERT audit_log (success ou failed com reason)
4. JWT assinado com { id, role, tenantId }
5. Cookie httpOnly + SameSite=Lax
```

### Envio de mensagem

```
1. Operator em /message: configura template, contatos, delay
2. POST /api/send/start
3. auth() → tenantId
4. sender.start({ tenantId, url, apiKey, instance, contacts, ... })
5. sender runner async (mesmo processo Node):
   a. For each contact:
      - Verifica daily_limit
      - loadSentLog(tenantId) → Set
      - Verifica se número já foi enviado
      - POST Evolution API /message/sendText/{instance}
      - markSent(tenantId, number)
      - Sleep random entre delay_min e delay_max
6. Broadcast WebSocket status: { type: "status", payload: {...} }
7. UI atualiza em tempo real
```

### Multi-tenancy (isolation)

Toda query Drizzle tem `WHERE tenant_id = ?` explícito. O `tenantId` vem
sempre de `session.user.tenantId` (validado pelo NextAuth). Super admin tem
`tenantId = null` e bypass de license check (mas não tem acesso aos dados
dos tenants via API — só via admin panel).

```
operator1 (tenant A)   operator2 (tenant B)
     │                       │
     └────┐             ┌────┘
          ▼             ▼
       auth()       auth()
     tenantId=A    tenantId=B
          │             │
          ▼             ▼
   API /api/contacts
          │
          ▼
   listContacts(tenantId)   ← vem da session, não do body
          │
          ▼
   SELECT * FROM contacts
   WHERE tenant_id = $1
```

## Stack

| Camada | Tech |
|---|---|
| Frontend | Next.js 14 + React 18 + TypeScript + Tailwind + shadcn/ui |
| Backend | Next.js API routes + custom server.ts |
| DB | SQLite (WAL) + Drizzle ORM |
| Auth | NextAuth v5 + bcryptjs |
| Crypto | AES-256-GCM (Node `crypto`) |
| Logger | Pino |
| WebSocket | `ws` (Node) |
| Real-time | WebSocket via hub |
| Deploy | Ubuntu 24.04 + nginx + systemd + certbot |
| HTTP | nginx reverse proxy + WebSocket upgrade |
| Backup | `sqlite3 .backup` via cron diário |
| Processo | `tsx server.ts` (não `next start`) |

## Decisões de design

- **Por que SQLite?** VPS de 2 GB aguenta 100k envios/dia; zero config; backup trivial
- **Por que 1 processo Node?** VPS pequeno; worker_threads complica shutdown
- **Por que sem Stripe?** v1 manual; admin gerencia licenças; v2 Stripe se necessário
- **Por que BYO Evolution?** *(atenuado — ver ADR-004)* Reduz superfície de ataque (clientes isolam creds); no modelo SaaS hospedado, **você hospeda 1 Evolution API por tenant** na sua VPS
- **Por que AES-256-GCM?** Authenticated encryption (detecta tampering); NIST approved
- **Por que in-memory rate limit?** 1 instância por VPS; Redis seria overkill
- **Por que audit log em texto?** Busca full-text; redact no logger evita leak de secrets

## Links relacionados

- [[MOC-SaaS-Web]] — mapa de pastas completo
- [[ADR-001-Contatos-Organizados]] — decisão do módulo de contatos
- [[ADR-002-Evolution-API-BYOTenant]] — decisão BYO Evolution (atenuada)
- [[ADR-004-Modelo-SaaS-Hospedado]] — **decisão atual de hospedagem** (você hospeda tudo)
- [[Modulo-Contatos-Web]] — ADR detalhado do módulo de contatos
- [[Seguranca]] — modelo de ameaças
- [[Deploy-VPS]] — guia de deploy
- [[Runbook-Onboarding-Cliente]] — como provisionar um tenant novo
