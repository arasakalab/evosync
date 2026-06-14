---
tipo: adr
tags: [evosync, adr, adr-002, arquitetura, seguranca, multi-tenant, legado]
criado: 2026-06-14
status: aceito
origem: evosync-web/docs/ARCHITECTURE.md (seção "Decisões de design")
---

# ADR-002 — Evolution API BYO (Bring Your Own) por tenant

> **Status:** ⚠️ **Atenuado por [[ADR-004-Modelo-SaaS-Hospedado]]** (BYO vira exceção avançada, não default) ·
> **Data original:** 2026-06-12 (v1.0) ·
> **Data da atualização:** 2026-06-14 ·
> **Escopo:** 100% em `evosync-web/` ·
> **Superseded by:** parcial-ADR-004 (use o ADR-004 como referência primária) ·
> **Autor:** agent-architect

> **Nota de 2026-06-14:** este ADR foi escrito quando o modelo de hospedagem
> ainda não estava decidido. Com a decisão do [[ADR-004-Modelo-SaaS-Hospedado]],
> o default passou a ser **você hospeda TUDO** (1 Evolution API por tenant na
> sua VPS). A arquitetura aqui descrita (cripitografia AES-256-GCM, campo
> `evoApiKeyEncrypted`, BYO opcional) continua **válida e útil** como
> mecanismo técnico — é o que permite, quando o cliente exigir, ele trazer
> a própria Evolution API. Mas não é mais o fluxo padrão.

## Contexto

EvoSync é um SaaS multi-tenant que envia mensagens WhatsApp via Evolution
API. A pergunta arquitetural era: **a Evolution API roda centralizada (um nó
compartilhado por todos os tenants) ou cada tenant traz a própria?**

### Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **A. Centralizada** (1 Evolution API por VPS, usada por todos os tenants) | Simples, 1 chave mestra, fácil de auditar | Risco集中: ban de 1 número afeta todos; rate-limit compartilhado; cliente não tem controle da instância |
| **B. BYO por tenant** (cada tenant cadastra URL + API key + instance) | Isolamento total; cliente controla a instância; horizontal scale natural; menos superfície de ataque | UX de onboarding mais complexa; precisa encriptar creds; suporte precisa entender N infraestruturas |
| **C. Híbrida** (centralizada com plano "pro" BYO) | Caminho de migração suave | Duas code paths, mais bugs, mais testes |

## Decisão

**Opção B — BYO por tenant.** Cada tenant cadastra `EVO_URL`, `EVO_APIKEY` e
`EVO_INSTANCE` na aba **Conexão** da UI (ou via `/admin/login` na primeira
configuração).

### Implementação

- Tabela `tenants.evoApiKeyEncrypted` (TEXT) — armazena API key encriptada.
- Algoritmo: **AES-256-GCM** (authenticated encryption).
- Key: `ENCRYPTION_KEY` em `.env` (32 bytes = 64 hex chars), permissão 0600.
- Formato armazenado: `iv:ciphertext:tag` (base64), gerado por `lib/crypto.ts`.
- Decriptado em memória no momento do `sender.start()` e passado ao `SenderRunner`.
- Redact automático no logger — `evoApiKey` nunca aparece em logs.
- `.env` do app tem `EVO_URL/APIKEY/INSTANCE` **opcionais** (legacy/fallback);
  vars por-tenant prevalecem se preenchidas.

## Consequências

### Positivas
- **Isolamento de risco:** ban de 1 número WhatsApp afeta só 1 tenant.
- **Superfície de ataque reduzida:** EvoSync nunca toca nas creds em texto puro
  em repouso; nem mesmo em logs.
- **Horizontal scale natural:** cada tenant escala sua Evolution API
  independentemente (5-10 tenants por VPS, cada um ~50-200 envios/min).
- **Compliance:** creds encriptadas em repouso + audit log + rate limit por email/IP.
- **Onboarding transparente:** tenant cola URL+key e está pronto.

### Negativas
- **UX de onboarding mais complexa:** cliente precisa ter Evolution API própria.
- **Suporte precisa entender N infraestruturas:** diferentes versões, uptime, logs.
- **Dependência de `ENCRYPTION_KEY`:** se vazar, todas as creds podem ser decriptadas.
  Mitigação: arquivo com permissão 0600, rotação anual, auditoria periódica.

### Neutras
- Estratégia de criptografia documentada em [[Seguranca]].
- Variaveis `EVO_*` no `.env` continuam existindo como fallback/first-tenant.

## Critérios de aceite (verificáveis)

- [x] Cada tenant vê apenas suas próprias credenciais encriptadas no DB.
- [x] `EVO_APIKEY` nunca aparece em log (pino redact).
- [x] Decriptação só ocorre em runtime, com `ENCRYPTION_KEY` válido.
- [x] `lib/crypto.ts` tem testes unitários de round-trip.
- [x] Rotação de `ENCRYPTION_KEY` exige re-encriptar todas as linhas (script de migração).

## Alternativas rejeitadas (resumo)

- **Centralizada (A):** rejeitada por risco集中 e perda de autonomia do cliente.
- **Híbrida (C):** rejeitada por complexidade de manter 2 code paths.

## Modelo de hospedagem (atualizado 2026-06-14)

O modelo de hospedagem (quem roda a Evolution API) é decidido em [[ADR-004-Modelo-SaaS-Hospedado]].
**TL;DR:** você hospeda TUDO, 1 Evolution API por tenant na sua VPS. BYO vira
exceção para clientes que exigem hosting próprio por compliance/regulamentação.

A criptografia AES-256-GCM continua sendo útil mesmo quando você hospeda,
porque isola a API key no `.env` do tenant e impede que um vazamento de log
ou backup exponha a credencial.

## Links relacionados

- [[ADR-004-Modelo-SaaS-Hospedado]] — **referência primária** (decisão atual de hospedagem)
- [[Visao-Geral]] — diagrama de componentes (mostra Evolution API por tenant)
- [[Seguranca]] — modelo de ameaças + criptografia AES-256-GCM
- [[Deploy-VPS]] — vars `EVO_*` opcionais no `.env`
- [[MOC-SaaS-Web]] — onde `tenants.evoApiKeyEncrypted` e `lib/crypto.ts` vivem
- [[Runbook-Onboarding-Cliente]] — fluxo de provisionar Evolution por tenant
