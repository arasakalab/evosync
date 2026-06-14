# Changelog (raiz)

Repositório com 2 apps: `EvoTeste - mod2/` (Python desktop legado) e
`evosync-web/` (versão web SaaS). Cada um tem seu próprio changelog
detalhado.

## Onde está o changelog de cada app

| App | Changelog | Última versão |
|---|---|---|
| `evosync-web/` (Next.js, SaaS) | [`evosync-web/docs/CHANGELOG.md`](./evosync-web/docs/CHANGELOG.md) | **1.1.0** (Contatos Organizados) |
| `main.py` (Python desktop, legado) | sem changelog (versão única estável) | — |

## Última mudança notável

### 2026-06-14 — v1.1.0 (web)

ADR-001 implementado em `evosync-web/`: a tela de Contatos agora separa
**catálogo** de **seleção de envio**, com tags, listas nomeadas, opt-out
(LGPD/anti-ban) e seleção persistente na nuvem.

**Resumo em uma frase:** o usuário pode importar 500 contatos, marcar
80 com checkbox, criar uma lista "Campanha X" com esses 80, agendar um
disparo às 18h, e a Evolution API só vai receber os 80 — mesmo que o
usuário edite a seleção depois.

Detalhes técnicos em [`evosync-web/docs/contacts-organization.md`](./evosync-web/docs/contacts-organization.md).
