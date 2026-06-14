---
tipo: moc
tags: [evosync, indice, raiz]
criado: 2026-06-14
status: ativo
aliases: [Home, Índice, MOC, EvoSync]
---

# MOC Raiz — EvoSync Knowledge Base

> Ponto de entrada do vault. Use `Ctrl+O` (switcher) ou o painel de **Backlinks**
> para navegar entre notas. Esta é uma [[MOC|Map of Content]] viva.

## O que é o EvoSync

EvoSync é um **disparador em massa para WhatsApp** baseado na [Evolution API v2](https://doc.evolution-api.com).
O repositório contém **dois apps** que coexistem:

- **App desktop legado** (raiz do repo) — Python + CustomTkinter, mono-operador, JSON files
- **SaaS web multi-tenant** (`evosync-web/`) — Next.js 14 + SQLite + Drizzle, multi-tenant com admin panel

## Navegação por papel

| Se você é... | Comece por |
|---|---|
| Novo no projeto | [[Visao-Geral]] → [[MOC-App-Desktop]] ou [[MOC-SaaS-Web]] |
| Operador de disparo | [[README-Projeto]] → [[Seguranca]] |
| Dev backend web | [[MOC-SaaS-Web]] → [[Visao-Geral]] |
| Dev desktop Python | [[MOC-App-Desktop]] |
| DevOps / deploy | [[Deploy-VPS]] → [[Seguranca]] |
| Arquiteto / mantenedor | [[ADR-001-Contatos-Organizados]] → demais ADRs |
| **SaaS provider (você)** | [[ADR-004-Modelo-SaaS-Hospedado]] → [[Runbook-Onboarding-Cliente]] |
| **Cliente B2B (pagou pra usar)** | [[Guia-Cliente-Primeiros-Passos]] |

## Mapas de conteúdo (MOCs)

- [[MOC-App-Desktop]] — módulos Python: `main.py`, `evo_client`, `sender_worker`, `scheduler_store`, `contacts_store`, `opencode_client`
- [[MOC-SaaS-Web]] — Next.js: `lib/`, `server/`, `app/`, `components/`, `data/`
- ← você está aqui → [[MOC-Raiz]]

## Decisões arquiteturais (ADRs)

- [[ADR-001-Contatos-Organizados]] — Web v1.1.0: separar catálogo de seleção de envio
- [[ADR-002-Evolution-API-BYOTenant]] — cada tenant traz sua própria Evolution API (⚠️ atenuado, ver ADR-004)
- [[ADR-003-Stack-Python-Desktop-Legado]] — por que `main.py` segue em Python/CustomTkinter
- [[ADR-004-Modelo-SaaS-Hospedado]] — você hospeda TUDO, mensalidade fixa por tenant

## Documentação importada

### Arquitetura
- [[Visao-Geral]] — diagrama de componentes, fluxos, stack (do `docs/ARCHITECTURE.md` web)
- [[Modulo-Contatos-Web]] — ADR detalhado do módulo de contatos web

### Operação
- [[Deploy-VPS]] — Ubuntu 24.04, systemd, nginx, certbot, backup
- [[Seguranca]] — modelo de ameaças, criptografia AES-256-GCM, boas práticas

### Negócios / produto
- [[README-Projeto]] — visão geral do produto (do README raiz + CHANGELOG raiz)
- [[Guia-Cliente-Primeiros-Passos]] — manual do cliente B2B (linguagem leiga)

## Modelo SaaS / Onboarding de clientes

> O EvoSync é vendido como serviço: você hospeda, cliente paga mensalidade.
> Veja [[ADR-004-Modelo-SaaS-Hospedado]] para a decisão completa.

### Para você (SaaS provider / super_admin)

- [[Runbook-Onboarding-Cliente]] — como provisionar um cliente novo (~15-20 min)
- [[Runbook-Cobranca-Licenca]] — ciclo de mensalidade, renovar, suspender
- [[Runbook-Suporte-Diagnostico]] — quando o cliente reclama

### Para o cliente (B2B leigo)

- [[Guia-Cliente-Primeiros-Passos]] — passo a passo do zero até o primeiro disparo

## Diário (timeline operacional)

- [[2026-06-14]] — início da estruturação do vault Obsidian

## Templates

- [[Template-ADR]] — esqueleto reutilizável para novos ADRs

## Design System

Documentação visual do admin EvoSync v2 (Linear + Vercel minimal, dark default).

- [[Design-System-v2]] — visão geral do redesign
- [[Design-Tokens]] — cores HSL, tipografia, espaçamento, sombras, animações
- [[Componentes]] — catálogo (StatCard, PageHeader, StatusBadge, EmptyState, ConfirmDialog, CommandPalette, etc.)
- [[Direcao-Visual]] — referências e decisões de design

## Tags mais usadas

`#evosync` `#adr` `#arquitetura` `#operacao` `#seguranca` `#desktop` `#web` `#lgpd`

## Convenções do vault

- **Frontmatter** com `tipo:`, `tags:`, `criado:`, `status:` — prepara terreno para Dataview/Bases
- **Links entre notas** via `[[Nome-da-Nota]]` — sem URLs relativas
- **Status**: `ativo` · `rascunho` · `legado` · `superseded`
- **Tipo**: `moc` · `adr` · `doc` · `runbook` · `diario` · `template`
