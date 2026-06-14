---
tipo: adr
tags: [evosync, adr, adr-001, arquitetura, contatos, web]
criado: 2026-06-14
status: aceito
origem: evosync-web/docs/contacts-organization.md (resumido)
---

# ADR-001 — Contatos Organizados (separar catálogo de seleção)

> **Status:** Aceito (versão web v1.1.0, Fases 1-5 implementadas) ·
> **Data:** 2026-06-14 ·
> **Escopo:** 100% em `evosync-web/` (Next.js 14 + Drizzle/SQLite + Zustand) ·
> **Superseded by:** — ·
> **Autor:** agent-architect ·
> **Detalhes:** ver [[Modulo-Contatos-Web]]

## Contexto

A tela de Contatos misturava dois conceitos: **catálogo** (todos os contatos
conhecidos) e **seleção de envio** (subconjunto que vai no próximo disparo).
O usuário reclamou: *"importei 500, só 80 vão para a campanha X"*.

### Problemas concretos

1. `app/api/send/start/route.ts` chamava `listContacts(tenantId)` sem filtro.
2. Seleção na UI era `Set<number>` por **índice** em `useState` — volátil, some ao recarregar.
3. Tipo `Contact` no frontend tinha perdido o `id` (mapper descartava `r.id`).
4. Reimport silenciava `name/tags/opt_out` do operador.
5. `SenderRunner` não checava `opt_out` — sem LGPD/anti-ban persistente.
6. `listContacts` carregava a tabela inteira em JS (gargalo em 5k+).

## Decisão

Adotar **separação conceitual catálogo vs. seleção**, com:

- Tabela `contact_selections` (1 row por tenant) persistindo IDs marcados.
- `Contact` estendido: `name`, `tags`, `lists`, `opt_out`, `notes`, `updated_at`.
- 3 tabelas novas: `contact_lists`, `contact_list_members`, `contact_selections`.
- UI `/contatos` reescrita: 3 modos (Todos/Selecionados/Opt-out) + chips de tag/lista + 7 colunas + contador inteligente + barra de ação em massa.
- `listContacts` com filtros SQL server-side (`q`, `mode`, `tag`, `list`, `opt_out`, `limit`, `offset`).
- `addContactsBulk` com **upsert merge** (preserva opt-out/tags do operador).
- `SenderRunner` pula contatos com `opt_out = 1` (novo stage `opt_out`).
- `POST /api/send/start` aceita `contactIds?: string[]` — backend é fonte da verdade.

## Consequências

### Positivas
- LGPD/anti-ban atendido: opt-out persistente e respeitado em todos os pontos de envio.
- UX clara: header mostra `X catálogo · Y selecionados · Z opt-out`.
- Performance: filtros SQL server-side suportam 5k+ contatos.
- Reimport seguro: opt-out/tags nunca são sobrescritos.
- Agendamento previsível: `current` congela `selected_contact_ids` no momento do agendamento.

### Negativas
- 2 migrations aditivas (custo de migração único).
- Sincronização Zustand ↔ backend precisa de debounce 300ms (race no mount).
- Para catálogos 50k+, `JSON_EXTRACT` pode precisar de tabela relacional `contact_tags` (fora do escopo).

### Neutras
- Stack mantida: Next.js 14 + Drizzle/SQLite + Zustand (sem microsserviço, sem Redis).
- 5 specs E2E Playwright adicionadas (organize, persistence, view modes, isolation UI, isolation API).

## Critérios de aceite (todos verdes)

- [x] G1: Seleção persiste entre reloads
- [x] G2: Reimport CSV preserva opt-out/tags
- [x] G3: Schedule `current` congela seleção vigente
- [x] G4: SenderRunner pula opt-out
- [x] G5: Filtros SQL combinam
- [x] G6: Tenant isolation (catálogo + API)
- [x] G7: Migration aditiva não perde dados
- [x] G8: `npm run typecheck && npm run lint` passam

## Links relacionados

- [[Modulo-Contatos-Web]] — especificação completa (schema, endpoints, UI, WBS)
- [[Visao-Geral]] — visão macro
- [[MOC-SaaS-Web]] — onde tudo isso vive no código
- [[Seguranca]] — implicações LGPD
- [[Template-ADR]] — template para futuros ADRs
