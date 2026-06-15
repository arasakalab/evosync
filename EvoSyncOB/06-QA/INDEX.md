---
tipo: moc
tags: [evosync, qa, testes, indice]
criado: 2026-06-15
status: ativo
---

# MOC — Quality Assurance

> Pasta dedicada a **relatórios de execução de testes** do projeto EvoSync.
> Cada relatório é um snapshot datado: o que foi testado, resultados, próximos passos.

## Convenção de nomenclatura

- `Relatorio-Testes-YYYY-MM-DD.md` — relatório completo de uma execução
- `INDEX.md` — esta página

## Relatórios

| Data | Resumo | Status geral |
|---|---|---|
| [[Relatorio-Testes-2026-06-15]] | Suite completa: typecheck, lint, build, bash/python/yaml, helper backup, links do vault, Playwright E2E — **sessão 2**: E2E atualizados, **5/5 passando** | ✅ 100% — todas categorias OK, E2E corrigidos |

## Como rodar a próxima bateria de testes

```bash
cd evosync-web

# 1. TypeScript
npm run typecheck

# 2. Lint
npm run lint

# 3. Build de produção
npm run build

# 4. Sintaxe de bash scripts
cd .. && for f in $(find . -name "*.sh" -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.venv/*"); do bash -n "$f"; done

# 5. Sintaxe de Python
for f in $(find . -name "*.py" -not -path "*/.venv/*" -not -path "*/node_modules/*"); do python3 -m py_compile "$f"; done

# 6. Validar YAML
find . -name "*.yaml" -o -name "*.yml" | xargs -I{} python3 -c "import yaml; yaml.safe_load(open('{}'))"

# 7. (Opcional) E2E
cd evosync-web
npm run db:seed:e2e
npm run test:e2e
```

## Links relacionados

- [[MOC-Raiz]] — entrada do vault
- [[Design-System-v2]] — mudanças visuais que podem quebrar seletores E2E
- [[ADR-001-Contatos-Organizados]] — fase 6 (E2E tests) do ADR original
