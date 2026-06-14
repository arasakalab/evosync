---
tipo: moc
tags: [evosync, web, nextjs, saas, moc]
criado: 2026-06-14
status: ativo
origem: evosync-web/
---

# MOC — SaaS Web (Next.js multi-tenant)

> Versão web SaaS do EvoSync, multi-tenant, com admin panel, audit log e
> agendamento persistente. Veja [[Visao-Geral]] para o diagrama de componentes
> completo e [[ADR-002-Evolution-API-BYOTenant]] para a decisão arquitetural chave.

## Stack fixa

| Camada | Tech |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Linguagem | TypeScript |
| UI | React 18 + Tailwind + shadcn/ui |
| DB | SQLite (WAL) via Drizzle ORM 0.36 |
| Auth | NextAuth v5 + bcryptjs |
| Crypto | AES-256-GCM (Node `crypto`) |
| Logger | Pino (JSON prod / pretty dev) |
| Real-time | WebSocket via `ws` (hub custom) |
| Testes E2E | Playwright |
| Deploy | Ubuntu 24.04 + nginx + systemd + certbot |

## Estrutura de pastas

```
evosync-web/
├── app/                       ← App Router
│   ├── (app)/                 ← route group com AppShell (header + sidebar)
│   │   ├── page.tsx           ← dashboard
│   │   ├── contatos/          ← tela de Contatos (ADR-001)
│   │   ├── mensagem/          ← template + mídia
│   │   ├── agenda/            ← agendamentos
│   │   ├── conexao/           ← config Evolution API (BYO)
│   │   └── historico/         ← histórico de envios
│   ├── admin/                 ← route group SEM AppShell
│   │   ├── login/             ← sem chrome
│   │   └── (panel)/           ← com sidebar admin
│   │       ├── page.tsx       ← dashboard
│   │       ├── tenants/
│   │       ├── licenses/
│   │       ├── invites/
│   │       ├── users/
│   │       └── audit/
│   ├── invite/[token]/        ← pública, set-password
│   ├── license-expired/       ← bloqueio
│   ├── error.tsx
│   ├── not-found.tsx
│   └── global-error.tsx
├── components/
│   ├── ui/                    ← shadcn/ui primitives
│   ├── layout/                ← AppShell, Header, Sidebar, StatusBar
│   └── admin/                 ← AdminShell, LogoutButton
├── lib/
│   ├── auth.ts + auth.config.ts   ← NextAuth v5 (split edge/server)
│   ├── db/                     ← Drizzle schema, migrations, cliente
│   ├── crypto.ts               ← AES-256-GCM
│   ├── password.ts             ← bcrypt cost 10
│   ├── license.ts              ← CRUD + check de licenças
│   ├── rate-limit.ts           ← in-memory LRU+TTL
│   ├── logger.ts               ← pino
│   ├── store.ts                ← Zustand (cliente)
│   ├── api.ts                  ← helpers HTTP
│   ├── api-helpers.ts          ← requireTenantId, parseJsonBody, validateWith(zod)
│   ├── types.ts                ← Contact, Schedule, etc.
│   └── utils.ts                ← cn(), formatadores
├── server/
│   ├── sender/
│   │   ├── runner.ts           ← loop de envio (sem worker_threads)
│   │   └── manager.ts
│   ├── scheduler/
│   │   └── loop.ts             ← polling 30s, dispara agendamentos
│   ├── ws/
│   │   └── hub.ts              ← pub/sub WebSocket
│   ├── store/                  ← CRUD por domínio (sempre com tenantId)
│   │   ├── settings.ts
│   │   ├── contacts.ts         ← com filtros SQL (ADR-001.5)
│   │   ├── contact-lists.ts
│   │   ├── contact-selections.ts
│   │   ├── schedules.ts
│   │   ├── sent-log.ts
│   │   ├── invites.ts
│   │   └── audit.ts
│   └── audit.ts
├── hooks/
├── data/
│   └── evosync.db              ← SQLite (gitignored)
├── logs/
├── middleware.ts               ← edge-safe, protege /admin/*
├── server.ts                   ← custom server (http + ws + scheduler)
├── drizzle.config.ts
├── playwright.config.ts
├── scripts/
│   ├── seed-admin.ts
│   └── seed-e2e.ts
├── docs/                       ← markdown original (espelhado neste vault)
│   ├── ARCHITECTURE.md
│   ├── CHANGELOG.md
│   ├── contacts-organization.md
│   ├── DEPLOY_VPS.md
│   └── SECURITY.md
├── package.json
├── .env.example
└── next.config.mjs
```

## Bounded contexts (DDD)

| Contexto | Pasta | Responsabilidade |
|---|---|---|
| **Auth & Tenancy** | `lib/auth.ts`, `middleware.ts` | Login, sessão, multi-tenancy, RBAC |
| **Contacts** | `server/store/contacts*.ts`, `app/(app)/contatos/` | Catálogo, listas, tags, opt-out, seleção |
| **Send** | `server/sender/`, `app/(app)/disparo/` | Loop de envio, anti-ban, persistência |
| **Schedule** | `server/scheduler/`, `app/(app)/agenda/` | Agendamentos, polling, congelamento |
| **Admin** | `app/admin/(panel)/`, `server/store/tenants/` | Painel super_admin, licenças, audit |
| **Invite** | `app/invite/`, `server/store/invites.ts` | Convites single-use, expira em 7d |
| **Audit** | `server/store/audit.ts`, `app/admin/(panel)/audit/` | Log estruturado de ações sensíveis |

## Fluxos críticos

1. **Login** — `POST /api/auth/callback/credentials` → rate limit → bcrypt → audit log → JWT
2. **Envio** — `/disparo` → `POST /api/send/start` → sender runner async → Evolution API
3. **Multi-tenancy** — toda query Drizzle tem `WHERE tenant_id = ?` (tenantId vem da session, nunca do body)

Detalhes completos em [[Visao-Geral]].

## Decisões-chave vinculadas

- [[ADR-001-Contatos-Organizados]] — reorganização do módulo de contatos
- [[ADR-002-Evolution-API-BYOTenant]] — BYO Evolution API
- [[Modulo-Contatos-Web]] — especificação detalhada do módulo de contatos

## Como rodar local

```bash
cd evosync-web
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

## Como deployar

Veja [[Deploy-VPS]].
