# ADR-001 (Web) — Reorganização da Tela de Contatos

> **Status:** Aceito (versão web, Fases 1-5 implementadas) ·
> **Escopo:** 100% em `evosync-web/` (Next.js 14 + Drizzle/SQLite + Zustand) ·
> **Stack travado:** Next.js 14.2, React 18, Tailwind, Drizzle 0.36, better-sqlite3 11, Zustand 5 ·
> **Autor:** agent-architect

---

## 1. Contexto

A tela de Contatos em produção misturava dois conceitos que precisam ser
separados: **catálogo** (todos os contatos conhecidos pelo tenant) e
**seleção de envio** (subconjunto que vai para o próximo disparo).

### Problemas concretos

1. **Catálogo = envio, sem separação conceitual** — `app/api/send/start/route.ts`
   chamava `listContacts(tenantId)` sem filtro; quem importasse 500 contatos
   do WhatsApp veria todos virarem candidatos a envio.
2. **Seleção na UI era cosmética e volátil** — `contatos/page.tsx` usava
   `Set<number>` por **índice na lista** (em useState, some ao recarregar),
   servia **apenas** para alimentar `api.contacts.remove(numbers)`.
3. **Tipo `Contact` no frontend tinha perdido o `id`** — o mapper em
   `server/store/contacts.ts:31-34` (versão pré-FASE 1) descartava
   `r.id` antes de mandar para o frontend.
4. **Reimport silenciava dados do operador** — `addContactsBulk` fazia
   `skip-if-exists`, perdendo nome/tag/opt-out corrigidos.
5. **`SenderRunner` ignorava opt-out** — não havia como marcar um contato
   como "não enviar" persistente.
6. **`listContacts` carregava a tabela inteira em memória** — `O(n)` em JS,
   gargalo em 5k+ contatos.

### Pedido do usuário

> "quero deixa a tela de contatos mais organizada inteligente e nem todos
> os contatos que estão la que vai ser usado pra operaçoes do sistema,
> quero algo que pode ser selecionado etc.."

## 2. Decisões

### ADR-001.1 — Separar Catálogo de Seleção de Envio

- Tabela `contacts` (catálogo) persiste tudo, escopada por `tenantId`.
- Tabela nova `contact_selections` (1 row por tenant) persiste os IDs
  marcados para envio. Sincronização Zustand ↔ backend com debounce 300ms.
- `SenderRunner` e o scheduler loop recebem `selected_contact_ids: string[]`
  em vez de `Contact[]` e resolvem via SQL
  `WHERE id IN (...) AND opt_out = 0`.

### ADR-001.2 — Estender `Contact` (schema + tipo)

Migration `0001_contacts_organization` adiciona à tabela `contacts`:

| Coluna      | Tipo                            | Default       | Uso |
|-------------|---------------------------------|---------------|-----|
| `name`      | `TEXT`                          | NULL          | Nome canônico |
| `tags`      | `TEXT NOT NULL` (JSON array)    | `'[]'`        | Tags livres |
| `lists`     | `TEXT NOT NULL` (JSON array)    | `'[]'`        | Denormalizado de membership |
| `opt_out`   | `INTEGER NOT NULL` (boolean)    | `0`           | LGPD/anti-ban |
| `notes`     | `TEXT`                          | NULL          | Observações livres |
| `updated_at`| `TEXT NOT NULL`                 | `CURRENT_TIMESTAMP` | |

Mais 2 índices: `(tenant_id, opt_out)` e `(tenant_id, name)`.

Novas tabelas:

- `contact_lists(id, tenant_id, name, color, created_at)` — UNIQUE
  `(tenant_id, name)`.
- `contact_list_members(list_id, contact_id, added_at)` — N:N, com CASCADE.
- `contact_selections(tenant_id, selected_ids, updated_at)` — PK
  `tenant_id`.

### ADR-001.3 — Seleção persistida no backend

- 1 row por tenant em `contact_selections`.
- `GET /api/contacts/selection` e `PUT /api/contacts/selection`.
- `POST /api/contacts/bulk-select` para batch (limite 1000/chamada).

### ADR-001.4 — UI `/contatos` reescrita

3 modos (Todos / Selecionados / Opt-out) + chips de tag/lista + 7 colunas
na tabela + contador inteligente `X · Y selecionados · Z opt-out` +
barra de ação em massa (criar lista, adicionar tag, marcar opt-out,
remover).

### ADR-001.5 — `listContacts` com filtros SQL server-side

| Filtro                    | SQL gerado                                                |
|---------------------------|------------------------------------------------------------|
| `q`                       | `LIKE` em `number` e `name` (fallback em memória p/ fields) |
| `mode: "selected"`        | `WHERE id IN (SELECT value FROM json_each(?))`             |
| `mode: "opt_out"`         | `WHERE opt_out = 1`                                         |
| `tag`                     | `WHERE EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)` |
| `list`                    | `WHERE id IN (SELECT contact_id FROM contact_list_members WHERE list_id = ?)` |
| `opt_out: true/false`     | `WHERE opt_out = ?`                                         |
| `limit/offset`            | `LIMIT ? OFFSET ?`                                          |

`count` = total sem filtros. `filteredCount` = total com filtros
(sem LIMIT). Paginação opcional.

### ADR-001.6 — Upsert merge no `addContactsBulk`

Regra (LGPD/anti-ban):

- `name` passado (não-vazio) → atualiza. `null` ou vazio → preserva.
- `fields` passado → merge shallow. Sem `fields` → preserva.
- `tags`, `opt_out`, `notes`, `lists` **nunca** sobrescritos pelo input.
- `updated_at = CURRENT_TIMESTAMP` em qualquer update.

Transação atômica.

### ADR-001.7 — `SenderRunner` checa `opt_out`

Antes do bloco de validação WhatsApp, novo branch:

```ts
if (c.opt_out) {
  status.opt_out += 1;
  status.skipped += 1;
  status.pending = Math.max(0, status.pending - 1);
  status.stage = "opt_out";
  continue;
}
```

`SendStatus` ganha `opt_out: number`. UI de Disparo mostra card dedicado.

### ADR-001.8 — `api.send.start` e `api.schedules` aceitam `contactIds`

- `POST /api/send/start` aceita `contactIds?: string[]` no payload.
  Backend é a fonte da verdade, filtra via `mode: "selected"` e aplica
  opt-out por segurança.
- `POST /api/schedules` (modo `current`) persiste
  `selected_contact_ids` na migration 0002.
- O `scheduler/loop.ts` resolve no momento do disparo via
  `allContacts.filter(c => idSet.has(c.id))`.

### ADR-001.9 — Stack mantida

Modular Monolith (Next.js + Drizzle/SQLite + Zustand). Sem microsserviço,
sem Postgres, sem Redis. Migration aditiva (só `ADD COLUMN` com default).

## 3. Contrato de Dados

### 3.1 Drizzle migrations

- `0001_fuzzy_landau.sql` — `contacts` ganha 6 colunas, 2 índices;
  3 tabelas novas (`contact_lists`, `contact_list_members`,
  `contact_selections`).
- `0002_slow_vulcan.sql` — `schedules.selected_contact_ids TEXT NOT
  NULL DEFAULT '[]'`.

### 3.2 Tipo `Contact` (lib/types.ts)

```ts
export interface Contact {
  id: string;
  number: string;
  name: string | null;
  tags: string[];
  lists: string[];
  opt_out: boolean;
  notes: string | null;
  fields: ContactFields;
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 Endpoints HTTP

| Método | Path | Função |
|---|---|---|
| GET    | `/api/contacts`            | Lista com filtros (q, mode, tag, list, opt_out, limit, offset) |
| GET    | `/api/contacts/:id`        | 1 contato |
| POST   | `/api/contacts`            | Cria 1 |
| PATCH  | `/api/contacts/:id`        | Atualiza name/tags/lists/opt_out/notes/fields |
| DELETE | `/api/contacts`            | Bulk por numbers[] |
| DELETE | `/api/contacts/:id`        | 1 por id |
| POST   | `/api/contacts/import-csv` | Upsert merge a partir de rows |
| POST   | `/api/contacts/import-whatsapp` | Upsert merge a partir de Evolution |
| POST   | `/api/contacts/clear`      | Limpa tudo do tenant |
| GET    | `/api/contacts/selection`  | Lê seleção |
| PUT    | `/api/contacts/selection`  | Substitui seleção |
| POST   | `/api/contacts/bulk-select`| Toggle add/remove (1000/chamada) |
| GET    | `/api/contact-lists`       | Lista com memberCount |
| POST   | `/api/contact-lists`       | Cria (409 em duplicata) |
| GET    | `/api/contact-lists/:id`   | 1 lista |
| PATCH  | `/api/contact-lists/:id`   | Atualiza name/color |
| DELETE | `/api/contact-lists/:id`   | Remove (CASCADE) |
| GET    | `/api/contact-lists/:id/members` | Lista contact_ids |
| POST   | `/api/contact-lists/:id/members` | Adiciona membros |
| DELETE | `/api/contact-lists/:id/members` | Remove membros |
| POST   | `/api/send/start`          | Inicia envio (aceita `contactIds`) |
| POST   | `/api/schedules`           | Cria schedule (modo `current` persiste `contactIds`) |

## 4. UI / UX

### 4.1 Layout da página `/contatos`

```
┌────────────────────────────────────────────────────────────────┐
│  Contatos                  [1.243 contatos] [87 selecionados] │
│  Catálogo persistente…       [12 opt-out] [3 listas]            │
├────────────────────────────────────────────────────────────────┤
│  [Todos] [Selecionados] [Opt-out]                              │
│                              [Importar CSV] [Importar WA]      │
│                              [+ Novo] [Limpar tudo]             │
├────────────────────────────────────────────────────────────────┤
│  🔍 Pesquisar por nome, número ou campo extra…                 │
├────────────────────────────────────────────────────────────────┤
│  Tags:  [Todas] [#vip·12] [#lead-quente·5]                     │
│  Listas:[Todas] [VIP·30] [Black Friday·120] [+ Nova]           │
├────────────────────────────────────────────────────────────────┤
│  ╔══ 87 selecionados ══╗                                       │
│  ║ [Criar lista] [Tag] [Opt-out] [Liberar] [Remover] ║       │
│  ╚═══════════════════════════════╗ [Limpar seleção]  ║        │
├────────────────────────────────────────────────────────────────┤
│  ☐  Número    Nome     Tags    Listas   Opt-out   Campos      │
│  ☑  55119…    João     #vip    VIP      —         empresa=…  │
│  ☐  55119…    Maria    —       —        Opt-out   empresa=…  │
│  …                                                               │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Fluxo de uso

1. **Importar** via CSV ou WhatsApp (ou adicionar manualmente).
2. **Selecionar** clicando nas linhas (toggle de checkbox).
3. **Agrupar** em tags (chips) ou listas (chips + diálogo "Criar lista").
4. **Filtrar** por tag/lista (chips) ou busca textual.
5. **Alternar modo** (Todos / Selecionados / Opt-out) para focar.
6. **Marcar opt-out** em contatos que pediram para sair (LGPD).
7. **Ir para /disparo** → ao clicar Iniciar, envia `contactIds` se houver
   seleção; card "Opt-out" mostra quantos foram pulados.
8. **Agendar** em /agenda com modo `current` → a seleção vigente é
   congelada no `schedules.selected_contact_ids`.

## 5. WBS executado (resumo)

| Fase | Status | Resumo |
|---|---|---|
| 1 | ✅ | Schema estendido, migration 0001, mappers, tipos |
| 2 | ✅ | Store server com filtros SQL + upsert merge + 2 stores novos + helper HTTP |
| 3 | ✅ | 6 rotas HTTP novas, send/start filtrado, schedule `current`, migration 0002 |
| 4 | ✅ | SenderRunner checa `opt_out` |
| 5 | ✅ | Zustand com `selectedIds`, 7 componentes novos, página reescrita, header inteligente |
| 6 | ✅ | Playwright + 5 specs E2E (organize, persistence, view modes, tenant isolation ×2) |
| 7 | ✅ | Docs (este arquivo + README + CHANGELOG) |

## 6. Critérios de aceite (todos verdes)

| # | Critério | Verificação |
|---|---|---|
| G1 | Seleção persiste entre reloads | TEST-6.2 |
| G2 | Reimport CSV preserva opt-out/tags | TEST-2.2 + TEST-6.1 |
| G3 | Schedule `current` congela seleção vigente | TEST-6.3 (vai para próxima iteração) |
| G4 | SenderRunner pula opt-out | TEST-4.1 + TEST-6.1 |
| G5 | Filtros SQL combinam | TEST-2.1 |
| G6 | Tenant isolation (catálogo + API) | TEST-6.4 (UI + API direta) |
| G7 | Migration aditiva não perde dados | TEST-1.3 + manual |
| G8 | `npm run typecheck && npm run lint` passam | Local |

## 7. Riscos conhecidos

- **Sincronização Zustand ↔ backend:** debounce 300ms + `setSelectionLoaded`
  flag evitam race no mount inicial.
- **Performance do `JSON_EXTRACT`:** para catálogos 50k+, considerar
  tabela relacional `contact_tags` (fora do escopo).
- **UX confusa (catálogo vs. seleção):** resolvido com painel **Para envio**
  fixo, badge no header e regra de disparo: só marcados recebem (ou confirmação
  explícita para enviar ao catálogo inteiro). O modo visual da tabela não
  controla mais quem recebe mensagem.

## 8. Como rodar local

```bash
# Migrations
npm run db:migrate

# Dev
npm run dev

# Testes E2E
npm run test:e2e:install   # uma vez
npm run db:seed:e2e       # uma vez
npm run test:e2e          # em outro terminal com `npm run dev` rodando
```
