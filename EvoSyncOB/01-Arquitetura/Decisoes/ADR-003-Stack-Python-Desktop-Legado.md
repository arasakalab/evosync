---
tipo: adr
tags: [evosync, adr, adr-003, arquitetura, desktop, python, legado]
criado: 2026-06-14
status: aceito
---

# ADR-003 — Manter app desktop em Python/CustomTkinter

> **Status:** Aceito ·
> **Data:** 2026-06-12 (v1.0 web) ·
> **Escopo:** raiz do repo (`main.py` + módulos Python) ·
> **Superseded by:** — ·
> **Autor:** agent-architect

## Contexto

A v1.0 do SaaS web ([[MOC-SaaS-Web]]) foi lançada em 2026-06-12, **migrando o
produto** de app desktop mono-operador (Python) para SaaS multi-tenant
(Next.js). A pergunta agora é: **o que fazer com o app desktop legado?**

### Cenário atual

- `main.py` tem 83 KB (módulo único monolítico) — totalmente funcional.
- Operadores solo (1 pessoa, 1 máquina) continuam usando.
- Não há multi-tenancy, não há admin panel, não há WebSocket, não há audit log.
- Persistência em JSON files (`persisted_contacts.json`, `scheduled_messages.json`,
  `sent_log.json`, `config.json`) e `.env` para creds.

### Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **A. Manter como está** (estável, sem novas features) | Zero risco; sem retrabalho; usuários atuais não são afetados | Dívida técnica cresce; nenhum aprendizado é reaproveitado; confusão "qual versão uso?" |
| **B. Refatorar `main.py` em módulos** (separar UI, sender, scheduler) | Melhora manutenibilidade; permite portar lógica p/ web depois | Esforço alto; sem benefício direto pro usuário; adia o inevitável |
| **C. Descontinuar (sunset)** | Força migração pro SaaS; reduz superfície de manutenção | Quebra usuários solo que não querem SaaS; perde casos de uso legítimos |
| **D. Manter + portar lógica gradualmente** | Caminho de menor risco; lógica é reusada (anti-ban, warm-up) | Precisa disciplina: o que vai pra web precisa de teste no desktop também |

## Decisão

**Opção D — Manter + portar gradualmente.** Decisões:

1. **Desktop segue estável e funcional.** Bugfixes e melhorias de UX pontuais
   são aceitas; novas features grandes vão **só** pro SaaS web.
2. **Lógica de envio (`sender_worker.py`), `evo_client.py`, anti-ban, warm-up**
   são candidatas a serem **portadas/inspiradas** pela implementação web
   (`server/sender/runner.ts`), mas **não compartilhadas** (Python vs. TS).
3. **Migração para web é incentivada** mas **não forçada.** Usuários solo
   podem ficar no desktop.
4. **`main.py` permanece monolítico** até que uma refatoração específica
   justifique o esforço (ex: bug recorrente em uma área).
5. **CHANGELOG raiz** aponta para o changelog do web; desktop não tem versão.

## Consequências

### Positivas
- **Usuários solo não são prejudicados:** continuam com o app que já conhecem.
- **Caminho de migração suave:** quem quer multi-tenant migra pro web quando quiser.
- **Lógica de envio reusada conceitualmente** (anti-ban, warm-up, opt-out eventual).
- **Histórico preservado:** `sent_log.json` e `scheduled_messages.json`
  podem ser importados (futuro) pro web.

### Negativas
- **Dívida técnica:** `main.py` com 83 KB permanece.
- **Documentação duplicada:** qualquer mudança conceitual precisa atualizar
  as duas stacks.
- **Confusão de "qual versão":** README raiz é claro, mas新人 pode se perder.

### Neutras
- O app desktop **não recebe mais novas features** além de bugfixes.
- Decisão revisada anualmente ou quando a base de usuários desktop cair abaixo de X%.

## Critérios de aceite (verificáveis)

- [x] `main.py` continua abrindo e funcionando em Linux e Windows.
- [x] `installer/install_linux.sh` e `install_windows.ps1` continuam idempotentes.
- [x] Documentação raiz (`README.md`, `CHANGELOG.md`) deixa claro que o
      app ativo é o **web** (`evosync-web/`) e o desktop é mantido para uso solo.
- [x] Anti-ban / warm-up do `sender_worker.py` é mapeado conceitualmente
      para o `server/sender/runner.ts` (ver [[Visao-Geral]]).

## Alternativas rejeitadas (resumo)

- **A (manter como está sem porta conceitual):** rejeitada por perder o
  reuso de aprendizado entre as stacks.
- **B (refatorar `main.py`):** rejeitada por esforço sem benefício direto
  e por adiar o foco no web.
- **C (sunset):** rejeitada por quebrar usuários solo e por perder casos
  de uso legítimos (operador que não quer SaaS).

## Links relacionados

- [[MOC-App-Desktop]] — mapa do app desktop
- [[MOC-SaaS-Web]] — mapa do app web (sucessor conceitual)
- [[README-Projeto]] — visão geral do produto (desktop + web)
- [[Visao-Geral]] — arquitetura do web
