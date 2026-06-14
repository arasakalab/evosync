---
tipo: adr
tags: [evosync, adr, adr-004, saas, modelo-negocio, hospedagem]
criado: 2026-06-14
status: aceito
supersedes: parcial-ADR-002
---

# ADR-004 — Modelo SaaS Hospedado (Arasaka Lab é o provedor)

> **Status:** Aceito ·
> **Data:** 2026-06-14 ·
> **Escopo:** modelo de negócio + arquitetura multi-tenant ·
> **Superseded by:** — ·
> **Supersedes:** atenua [[ADR-002-Evolution-API-BYOTenant]] (BYO vira exceção) ·
> **Autor:** agent-architect

## Contexto

O EvoSync foi construído como SaaS multi-tenant em [[Visao-Geral]]. Agora
precisamos decidir **quem opera a infraestrutura** e **como o cliente paga**.

### Pergunta de negócio

Como vendemos o EvoSync para clientes B2B que querem disparar mensagens
WhatsApp para os clientes finais deles?

### Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **A. Cliente auto-hospeda** (cada um roda na própria VPS) | Zero ops pra você; sem limite de escala | Cliente tem que ser técnico; onboarding lento; impossível dar suporte homogêneo |
| **B. BYO Evolution (você hospeda EvoSync, cliente traz Evolution)** | Você controla só a sua parte; cliente isola creds | Cliente leigo não sabe o que é Evolution; fricção enorme; suporte precisa entender N infraestruturas |
| **C. Você hospeda tudo** (EvoSync + Evolution API dedicada por tenant) | Onboarding rápido (~15 min); cliente não-técnico consegue usar; você controla qualidade | Você é o SPOF (single point of failure); precisa monitorar; precisa de processo de cobrança |
| **D. White-label** (cliente revende com a marca dele) | Alto ticket; recorrência previsível | Complexidade operacional; risco de churn; precisa de plano comercial |

## Decisão

**Opção C — Você hospeda TUDO**, com pequenas variações permitidas:

1. **EvoSync Next.js** roda **na sua VPS** (1 instância, multi-tenant, SQLite por enquanto).
2. **1 container Evolution API por tenant** (porta única, dados isolados).
3. **1 Postgres + 1 Redis compartilhados** entre tenants da Evolution (eficiência de recursos).
4. **Mensalidade fixa** por tenant (licença 30 dias, renovada manualmente pelo super_admin).
5. **Sem Stripe na v1** — você cobra manualmente (Pix, boleto, transferência) e renova no admin.
6. **BYO Evolution vira exceção avançada** — só se o cliente exigir (compliance específico, hosting próprio por motivo regulatório).

### Por que "você hospeda tudo"

- **Público-alvo é leigo**: clientes B2B que compram "WhatsApp marketing" não sabem provisionar VPS.
- **Onboarding rápido**: ~15-20 min do "me contrata" até "cliente disparando".
- **Suporte homogêneo**: você conhece 1 infraestrutura, não N.
- **Receita previsível**: mensalidade fixa, sem variação por uso (v1).
- **Posicionamento claro**: você é o provedor do serviço, não o fornecedor de software.

## Consequências

### Positivas
- **Onboarding de cliente em 15-20 min** (provisionar Evolution + criar tenant + emitir invite).
- **Cliente B2B leigo** consegue usar sozinho após ler o [[Guia-Cliente-Primeiros-Passos]].
- **Margem saudável**: você controla custo (VPS, domínio) e preço (mensalidade).
- **Crescimento previsível**: cada novo tenant = +1 container Evolution (custo ~R$5/mês de RAM), +1 linha no admin.
- **Suporte simplificado**: você tem 1 stack pra conhecer, e os tenants são isolados por porta.

### Negativas
- **Você é o SPOF**: se a VPS cai, **todos** os clientes param. Mitigação: monitoração, backup off-site, plano de disaster recovery.
- **Limite de escala**: VPS 2 GB aguenta ~5-10 tenants (ver [[Deploy-VPS]]). Acima disso, precisa migrar para VPS maior ou para Postgres.
- **Risco de concentration**: 1 cliente grande com uso intenso pode afetar os outros. Mitigação: limites de envios por tenant (daily_limit).
- **Cobrança manual** é trabalho. Mitigação: [[Runbook-Cobranca-Licenca]] padroniza.

### Neutras
- O produto **continua open source** (clientes técnicos podem ver o código).
- Você é o "guardião" da segurança (você lida com ENCRYPTION_KEY, AUTH_SECRET, etc).
- Plano de saída do cliente: ele perde acesso, dados ficam disponíveis por 30 dias para download.

## Critérios de aceite (verificáveis)

- [x] Cada tenant tem 1 container Evolution API com porta única.
- [x] Postgres + Redis compartilhados isolam dados por database name (`evo_<tenant_slug>`).
- [x] License de 30 dias renovada manualmente via `/admin/licenses`.
- [x] Cliente B2B consegue seguir o [[Guia-Cliente-Primeiros-Passos]] sem suporte.
- [x] Onboarding de novo cliente leva < 20 min ([[Runbook-Onboarding-Cliente]]).
- [x] BYO Evolution só é habilitado por demanda explícita.

## Alternativas rejeitadas (resumo)

- **A (cliente auto-hospeda):** rejeitada — público-alvo é leigo.
- **B (BYO Evolution como default):** rejeitada — fricção enorme pro leigo.
- **D (white-label):** rejeitada para v1 — complexidade comercial; considerar para v2.

## Onde isso aparece no sistema

- **Onboarding**: [[Runbook-Onboarding-Cliente]]
- **Cobrança**: [[Runbook-Cobranca-Licenca]]
- **Suporte**: [[Runbook-Suporte-Diagnostico]]
- **Guia do cliente**: [[Guia-Cliente-Primeiros-Passos]]
- **Infraestrutura**: [[Deploy-VPS]]
- **ADR anterior (BYO)**: [[ADR-002-Evolution-API-BYOTenant]] — agora é exceção avançada

## Links relacionados

- [[MOC-Raiz]] — seção "Modelo SaaS / Onboarding de clientes"
- [[Visao-Geral]] — arquitetura multi-tenant
- [[Seguranca]] — modelo de ameaças (você é o SPOF)
- [[Template-ADR]] — template para futuros ADRs
