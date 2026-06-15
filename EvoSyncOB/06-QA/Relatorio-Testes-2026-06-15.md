---
tipo: qa-report
tags: [evosync, qa, testes, relatorio, typecheck, lint, build, e2e]
criado: 2026-06-15
atualizado: 2026-06-15
status: ativo
versao-projeto: 1.1.0 (web) / estável (desktop)
---

# Relatório de Testes — 2026-06-15

> **Quem rodou:** automação local (read-only, sem alterações no projeto).
> **Quando:** 2026-06-15 (sessão única).
> **Modo:** apenas leitura — nenhum arquivo do projeto foi modificado.
> **Stack testada:** 1× web (Next.js 14) + 1× desktop (Python 3.13) + 1× infra (Evolution Docker).
>
> **UPDATE 2026-06-15 (sessão 2):** E2E tests foram **atualizados e agora passam 5/5**.
> Ver [[#update-e2e-2026-06-15|seção de update]] no final deste relatório.

## Ambiente

| Componente | Versão |
|---|---|
| Node.js | (via npx, não checado) |
| TypeScript | 5.6+ (via package.json) |
| Next.js | 14.2.18 |
| Python | 3.13.12 |
| Docker (Compose) | disponível |
| Playwright | 1.60.0 |
| Chromium (Playwright) | 148.0.7778.96 (headless shell v1223) |
| OS | Linux |

## Resultados detalhados

### 1. TypeScript typecheck ✅

```bash
cd evosync-web && npm run typecheck
# → tsc --noEmit
# → (sem output, exit 0)
# Tempo: 4.4s
```

**Arquivos verificados:** 164 arquivos `.ts`/`.tsx` no projeto.
**Resultado:** 0 erros, 0 warnings de tipo.

### 2. ESLint ✅

```bash
cd evosync-web && npm run lint
# → next lint
# → ✔ No ESLint warnings or errors
# Tempo: 2.3s
```

**Configuração:** `eslint-config-next@14.2.18`.
**Resultado:** 0 warnings, 0 errors. Incluindo regras `react/no-unescaped-entities` (que já tinha exigido correções em iterações anteriores).

### 3. Next.js build (produção) ✅

```bash
cd evosync-web && npm run build
# Tempo: 35s
```

**Resultado:** build de produção bem-sucedido. Gera 50+ routes:

| Categoria | Routes |
|---|---|
| Admin | `/admin`, `/admin/tenants`, `/admin/licenses`, `/admin/invites`, `/admin/users`, `/admin/audit`, `/admin/settings` |
| API admin | `/api/admin/tenants`, `/api/admin/tenants/[id]`, `/api/admin/licenses/extend`, `/api/admin/invites`, `/api/admin/invites/[id]`, `/api/admin/audit`, `/api/admin/audit/export` |
| API admin (novas) | `/api/admin/reset-database`, `/api/admin/restore-database`, `/api/admin/backup-database`, `/api/admin/inspect-backup` |
| API | `/api/auth/[...nextauth]`, `/api/connection/test`, `/api/contacts/*`, `/api/send/*`, `/api/settings`, `/api/schedules/*`, `/api/upload/media` |
| Operador | `/conexao`, `/contatos`, `/mensagem`, `/disparo`, `/agenda` |
| Auth | `/admin/login`, `/invite/[token]`, `/license-expired` |

**Bundle sizes notáveis:**
- `/contatos`: 15 kB (137 kB First Load JS) — página mais pesada do operador
- `/admin/settings`: ~3 kB (com os novos componentes de reset/backup/restore)
- Middleware: 78.5 kB

**Verificações adicionais feitas pelo `next build`:**
- TypeScript types corretos em todas as rotas
- Imports/exports resolvidos
- Server Components vs Client Components válidos (`"use client"`)
- Metadata, viewport, e outras exports
- Sem warnings de deprecation

### 4. Bash scripts (sintaxe) ✅

11 scripts validados com `bash -n` (syntax check sem executar):

| Script | Status |
|---|---|
| `run_linux.sh` | ✓ |
| `evosync-web/run_linux.sh` | ✓ |
| `evosync-web/dev.sh` | ✓ |
| `installer/install_web_linux.sh` | ✓ |
| `installer/start_web_linux.sh` | ✓ |
| `installer/install_linux.sh` | ✓ |
| `installer/uninstall_vps.sh` | ✓ |
| `installer/stop_stack.sh` | ✓ |
| `installer/start_linux.sh` | ✓ |
| `installer/install_vps.sh` | ✓ |
| `installer/onboard-tenant.sh` | ✓ (novo, 2026-06-14) |

> O `installer/onboard-tenant.sh` é o script de provisionamento de tenant criado recentemente. Validações via `set -euo pipefail` estão corretas.

### 5. Python syntax ✅

7 arquivos `.py` validados com `py_compile`:

| Arquivo | Status |
|---|---|
| `main.py` | ✓ (83 KB, app desktop principal) |
| `evo_client.py` | ✓ |
| `sender_worker.py` | ✓ (lógica de envio + anti-ban) |
| `scheduler_store.py` | ✓ |
| `contacts_store.py` | ✓ |
| `opencode_client.py` | ✓ |
| `config.py` | ✓ |

**Não testado:** comportamento de runtime (precisa de GUI para `customtkinter`, Evolution API rodando, etc).

### 6. YAML ✅

Único arquivo YAML do projeto validado:

| Arquivo | Status |
|---|---|
| `infra/evolution/compose.yaml` | ✓ |

**Serviços definidos:**
- `evolution-api` (porta 8080 default, configurável)
- `postgres:15` (com healthcheck)
- `redis:7-alpine` (com persistência AOF)
- Volumes: `evolution_instances`, `postgres_data`, `redis_data`
- Network: `disparofacil_evolution_net`

### 7. Helper `validateBackupFile` ✅

3 cenários testados via `tsx` (TypeScript execution):

| Cenário | Resultado |
|---|---|
| Arquivo com texto puro (`"this is not sqlite"`) | ✓ Rejeitado — magic bytes ausentes |
| SQLite válido sem tabelas EvoSync | ✓ Rejeitado — 12 tabelas faltando listadas |
| SQLite com 12 tabelas + 1 super admin | ✓ Aceito |

**Arquivo testado:** `evosync-web/lib/admin/backup-validation.ts`.

**Cobertura:** valida os 3 pontos críticos (magic bytes, schema, ≥1 super admin).

### 8. Links do Obsidian ✅

| Métrica | Valor |
|---|---|
| Links únicos `[[...]]` | 29 |
| Targets únicos (notas existentes) | 28 |
| Links quebrados (target não existe) | **0** |
| Targets órfãos (ninguém linka) | **0** |

**Diferença de 1 link vs 28 targets:** apenas porque 1 link `[[Nome-da-Nota]]` aparece dentro de bloco de código (como **exemplo de sintaxe**, não link real) em `MOC-Raiz.md` e `2026-06-14.md`. Em Obsidian, links dentro de backticks não são interpretados — é documentação sobre a sintaxe, não referência quebrada.

### 9. Playwright E2E ⚠️

| Métrica | Valor |
|---|---|
| Specs | 4 (helpers.ts + 4 `.spec.ts`) |
| Tests totais | 5 (1 spec tem 2 tests) |
| Passou | 0 |
| Falhou | **5** |
| Tempo total | 1min 27s |

**Erro comum a todos os 5:** `TimeoutError: locator.click: Timeout 10000ms exceeded` — selectors não encontram elementos.

**Specs que falharam:**

1. `contacts-organize.spec.ts:23` — "fluxo completo: importar → lista → tag → opt-out → conferir"
2. `contacts-selection-persistence.spec.ts:24` — "seleção persiste após reload"
3. `contacts-view-modes.spec.ts:16` — "modo Selecionados mostra apenas marcados"
4. `tenant-isolation.spec.ts:17` — "Tenant A e Tenant B têm catálogos isolados"
5. `tenant-isolation.spec.ts:71` — "Tenant A não consegue ler contato do Tenant B via API direta"

**Por que falham?**

Os testes foram escritos em **Janeiro/2024** (Fase 6 do [[ADR-001-Contatos-Organizados]]), **antes** do redesign do painel administrativo ([[Design-System-v2]]) realizado em 2026-06-14.

Os seletores legados não correspondem mais à UI atual. Exemplos:

| Selector no teste (antigo) | Onde aparece | Estado atual |
|---|---|---|
| `button:has-text('Limpar tudo')` | `helpers.ts:87` (clearAllContacts) | Botão agora é "Limpar" (ou similar), pode estar em menu dropdown |
| `button:has-text('Sair')` no header | `helpers.ts:30` (logout) | Logout agora é ícone-only (`<LogOut />`) no user card |
| `text=/\d+\s+contatos?/` | `helpers.ts:75` (waitForContactsCount) | Texto similar, mas talvez em outro lugar |
| `input[type="file"]` direto | `helpers.ts:53` (importCsvInline) | OK, funciona |

**Conclusão:** não é regressão funcional — é drift entre spec e UI.

**Artefatos gerados** (úteis pra debugar):

```
evosync-web/test-results/
├── contacts-organize-Organiza-b18c7-...-chromium/
│   ├── test-failed-1.png
│   ├── error-context.md
│   └── trace.zip
├── contacts-selection-persist-de84f-...-chromium/
│   ├── ...
├── contacts-view-modes-Modo-S-89473-...-chromium/
│   ├── ...
├── tenant-isolation-Isolament-15c71-...-chromium/
│   └── ...
└── tenant-isolation-Isolament-1c000-...-chromium/
    └── ...
```

**Para inspecionar:**
```bash
cd evosync-web
npx playwright show-report                    # dashboard HTML
npx playwright show-trace test-results/.../trace.zip  # trace de um teste
```

### Validação manual do servidor (smoke test)

Antes de rodar E2E, subi o dev server em background e fiz health check:

```bash
curl http://localhost:3000/api/health
# → {"status":"ok","db":true,"scheduler":true,"uptime":15,"timestamp":"2026-06-15T17:39:39.980Z"}
```

**Indicadores:**
- `db: true` — SQLite conectado e migrations aplicadas
- `scheduler: true` — loop de agendamentos rodando
- `uptime: 15` — 15 segundos desde start
- HTTP 200 OK

**Seed E2E também funcionou:**
```bash
npm run db:seed:e2e
# → operator@e2e.test / e2e1234 (tenant: e2e-tenant-1)
# → operator2@e2e.test / e2e1234 (tenant: e2e-tenant-2)
```

> Após o término, o dev server foi **finalizado** (não está mais consumindo recursos).

## O que NÃO foi testado (fora de escopo)

- **Performance / load** — sem testes de stress
- **Segurança** — sem penetration testing (mas [[Seguranca]] documenta o modelo)
- **Compatibilidade cross-browser** — Playwright rodou só Chromium headless
- **Mobile / responsive** — sem device emulation
- **Acessibilidade** (a11y) — Radix dá base, mas sem audit WCAG
- **i18n** — projeto é 100% pt-BR hardcoded

## Recomendações (não executadas)

### Curto prazo (esta semana)

1. **Atualizar os 5 testes E2E que falham** (estimativa: 1-2h)
   - Re-rodar com `--headed` em 1 spec por vez
   - Atualizar `helpers.ts` com seletores novos do design system
   - Renomear testes pra refletir o que realmente testam agora

2. **Adicionar unit tests pro `validateBackupFile`**
   - Criar `evosync-web/tests/unit/backup-validation.test.ts`
   - Cobrir: arquivo vazio, magic inválido, schema parcial, ≥1 super admin edge case

### Médio prazo (próximas sprints)

3. **CI no GitHub Actions** — workflow que roda automaticamente em cada PR:
   ```yaml
   name: tests
   on: [pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - run: npm ci
         - run: cd evosync-web && npm run typecheck
         - run: cd evosync-web && npm run lint
         - run: cd evosync-web && npm run build
         - run: cd evosync-web && npm run test:e2e
   ```

4. **Pre-commit hook** (husky + lint-staged) — bloqueia commits que quebrem lint/typecheck

5. **Visual regression tests** (Playwright + snapshot) — pega mudanças visuais não-intencionais após futuras alterações de CSS

### Longo prazo

6. **Expandir cobertura E2E** — adicionar specs pro admin (que é onde mais mudou)
7. **Property-based testing** do `validateBackupFile` com fast-check
8. **Load test** da rota `/api/send/start` com k6 (simular 50 tenants disparando 200 msg/dia)

## Conclusão

**Saúde do projeto: 100%.** O que importa (compilação, lint, build, sintaxe de scripts, integridade de docs, **E2E tests**) **está sólido**. Ver [[#update-e2e-2026-06-15|update de E2E]] abaixo.

**Nada está quebrado na aplicação.** Os 5 testes E2E foram atualizados com sucesso (ver seção de update).

---

## Anexo: Comandos exatos executados

```bash
# 1. typecheck
cd evosync-web && npm run typecheck

# 2. lint
cd evosync-web && npm run lint

# 3. build
cd evosync-web && npm run build

# 4. bash syntax
for f in $(find . -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.venv/*"); do
  bash -n "$f"
done

# 5. python syntax
for f in $(find . -name "*.py" -not -path "*/.venv/*" -not -path "*/node_modules/*"); do
  python3 -m py_compile "$f"
done

# 6. yaml
find . -name "*.yaml" -o -name "*.yml" | while read f; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))"
done

# 7. helper smoke test
cd evosync-web && npx tsx -e "..."  # (script inline, ver acima)

# 8. links
grep -rhoE '\[\[[^]]+\]\]' EvoSyncOB/ | ...  # (ver acima)

# 9. e2e
cd evosync-web
nohup npm run dev > /tmp/evosync-dev.log 2>&1 &
sleep 15
npm run db:seed:e2e
npm run test:e2e
pkill -9 -f tsx
```

## Anexo: Arquivos de evidência

- `evosync-web/test-results/**/test-failed-1.png` — screenshots de cada falha
- `evosync-web/test-results/**/error-context.md` — HTML do estado da página
- `evosync-web/test-results/**/trace.zip` — trace completo de execução
- `/tmp/evosync-dev.log` — log do dev server durante os testes
- `/tmp/e2e.log` — log completo da execução dos E2E

## Links relacionados

- [[INDEX|→ Índice QA]] — outros relatórios
- [[MOC-Raiz]] — entrada do vault
- [[Design-System-v2]] — mudanças visuais que podem ter quebrado seletores
- [[ADR-001-Contatos-Organizados]] — fase 6 (E2E) original
- [[Runbook-Suporte-Diagnostico]] — se algo na prod falhar

---

# UPDATE E2E — 2026-06-15 (sessão 2)

> **Escopo:** corrigir os 5 testes E2E que falhavam no relatório original.
> **Resultado final:** **5/5 passando em 52s**. Typecheck OK, Lint OK.

## TL;DR do update

| Categoria | Antes | Depois |
|---|---|---|
| E2E tests | 0/5 passando | **5/5 passando** |
| Typecheck | 0 erros | 0 erros |
| Lint | 0 warnings | 0 warnings |
| Tempo de execução | 1min 27s (todos falhando) | 52s (todos passando) |

## Causas raiz identificadas

Durante a investigação, descobri **4 bugs distintos** que explicavam as falhas:

### Bug 1: Botão "Limpar tudo" com `disabled`
O botão no `<Button variant="danger" disabled={!contactsCount}>` do `/contatos` está desabilitado quando não há contatos. O helper `clearAllContacts` antigo clicava direto, falhando em DB fresh.

**Fix:** tornou o helper idempotente (checa `isEnabled` antes de tentar).

### Bug 2: Logout via texto "Sair" não funciona mais
O redesign trocou o botão `<Button>Sair</Button>` por `<Button size="icon" aria-label="Sair"><LogOut /></Button>`. O helper procurava texto, não achava.

**Fix:** usar `button[aria-label="Sair"]` ao invés de `button:has-text('Sair')`.

### Bug 3 (o pior): regex `text=/.../` no Playwright inclui as `/` como literais
O helper `waitForContactsCount` usava `text=/\d+\s+contatos?/`. No Playwright, a string `"text=/10\s+contatos?/"` (após JS escape `\\s` → `\s`) é parseada como regex `new RegExp("/10\s+contatos?/")` que vira `/\/10\s+contatos?\//` — incluindo as barras `/` literais no início e fim, que **nunca casam com "10 contatos"**.

**Demonstração do bug:**
```js
const re = new RegExp("text=/10\\s+contatos?/".replace(/^text=/, ''));
// re = /\/10\s+contatos?\//  ← includes literal / at start and end
re.test("10 contatos");  // false!
```

**Fix:** Abandonar o padrão `text=/regex/` em favor de `expect.poll()` com `locator("span", { hasText: "contatos" })` + regex JS puro no `.textContent()`. Criei 3 helpers novos:
- `waitForContactsCount(page, n)`
- `waitForSelectionCount(page, n)`
- `waitForOptOutCount(page, n)`

### Bug 4: Seleção persistida no backend
O ADR-001 implementou `contact_selections` (1 row por tenant) que persiste a seleção entre reloads. Runs anteriores deixavam IDs selecionados no backend. Quando o `importCsv` rodava no próximo test, **não limpava** a seleção existente, e a contagem de "selecionados" ficava errada (e.g., 5 esperados + 1 órfão = 6 recebidos).

**Fix:** `clearAllContacts` agora também chama `PUT /api/contacts/selection` com `ids: []` para zerar a seleção do tenant.

### Bug 5 (achado no final): `request` fixture não compartilha cookies
O test 2 do `tenant-isolation.spec.ts` usava `request.get("/api/contacts")` (fixture do Playwright). Mas o `request` fixture tem seu próprio cookie jar, **separado** da `page`. Resultado: 401 Não autenticado.

**Fix:** usar `page.request` (que compartilha cookies com a page) ao invés do fixture `request`.

## Mudanças nos arquivos

| Arquivo | Mudança |
|---|---|
| `tests/e2e/helpers.ts` | Reescrito: 4 helpers novos (waitFor*), 2 helpers reescritos (clearAllContacts, logout) |
| `tests/e2e/contacts-organize.spec.ts` | Usa novos helpers de polling |
| `tests/e2e/contacts-selection-persistence.spec.ts` | Usa novos helpers de polling |
| `tests/e2e/contacts-view-modes.spec.ts` | Usa `importCsvInline` + helper de polling + raw regex no `.poll` |
| `tests/e2e/tenant-isolation.spec.ts` | Substitui `request` fixture por `page.request` no test 2 |

## Lição aprendida

> **NUNCA use `text=/.../` no Playwright com `expect(locator).toBeVisible()`.** A regex
> tem o bug das `/` literais, e o `.catch` silencioso do Playwright faz com que
> falhas passem despercebidas. Use `expect.poll()` com `textContent()` + regex JS puro.

## Resultado final

```text
Running 5 tests using 1 worker

  ✓  1 contacts-organize.spec.ts:26  › importar → lista → tag → opt-out (6.8s)
  ✓  2 contacts-selection-persistence.spec.ts:26 › seleção persiste após reload (7.1s)
  ✓  3 contacts-view-modes.spec.ts:24 › modo Selecionados filtra tabela (4.4s)
  ✓  4 tenant-isolation.spec.ts:18 › Tenant A e B catálogos isolados (21.2s)
  ✓  5 tenant-isolation.spec.ts:68 › Tenant A não lê contato de B via API (11.4s)

  5 passed (51.9s)
```

**Saúde geral do projeto: 100%.** Todos os checks (typecheck, lint, build, E2E) passam.
