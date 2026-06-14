---
tipo: runbook
tags: [evosync, runbook, cobranca, licenca, mensalidade, interno, saas]
criado: 2026-06-14
status: ativo
publico-alvo: interno
frequencia: mensal (ciclo de licença)
---

# Runbook — Cobrança e Licença

> **Quem usa:** você (super_admin do EvoSync).
> **Quando:** mensalmente, para cada tenant ativo.
> **Modelo:** mensalidade fixa, licença 30 dias, renovada manualmente.

## Modelo de cobrança

| Item | Valor |
|---|---|
| Tipo de cobrança | Mensalidade fixa por tenant |
| Forma de pagamento | Pix / boleto / transferência (definir por cliente) |
| Renovação | Manual, no `/admin/licenses` |
| Sem pagamento? | T-7 avisa, T+7 suspende, T+30 deleta (com backup) |
| Stripe? | **Não na v1** — apenas manual. Stripe pode entrar na v2. |

## Cadastro de controle

Mantenha uma planilha (Google Sheets, Airtable, ou similar) com:

| Tenant | Slug | Plano | Valor/mês | Vencimento | Status | WhatsApp do responsável | Notas |
|---|---|---|---|---|---|---|---|
| Acme LTDA | acme | Pro | R$ 199 | 2026-07-14 | ativo | (11) 9... | pediu desconto em maio |
| Padaria João | padaria-joao | Start | R$ 99 | 2026-07-20 | ativo | (11) 9... | |

> **Alternativa:** criar uma tabela `tenants_billing` no banco (v2).
> Por enquanto, planilha resolve.

## Ciclo de vida da licença

```
T-7d    Notificar cliente (WhatsApp) — "sua fatura vence em 7 dias"
T+0     Vencimento. Se não pagou → enviar aviso de +2 dias
T+2d    Re-avisar (WhatsApp + e-mail) — "ainda não identificamos o pagamento"
T+7d    Se não pagou → SUSPENDER (license expirada → tenant.suspended)
T+30d   Se não regularizou → BACKUP + DELETAR dados do tenant
```

> **Suspensão ≠ Deleção:** suspender bloqueia o login do cliente mas preserva
> todos os dados. Deleção é irreversível — só após 30 dias sem regularizar.

## Como renovar licença

Quando o cliente pagou:

1. Acesse `https://app.seudominio.com/admin/login` como super_admin.
2. Vá em `/admin/licenses`.
3. Encontre a licença do tenant (filtrar por nome/slug).
4. Clique em **"Renovar"**.
5. Sistema estende a licença em **+30 dias** a partir de hoje (ou da data de vencimento original, dependendo do admin).

> **Atalho:** se você tem muitos tenants, use a coluna "próximo vencimento"
> como filtro padrão. Renove em lote no dia 1 de cada mês.

## Como suspender (inadimplente)

1. Em `/admin/tenants` → encontre o tenant inadimplente.
2. Clique em **"Suspender"**.
3. Sistema:
   - Marca `tenants.suspended_at = now()`.
   - Bloqueia o login do cliente (license check retorna `expired`).
   - Cliente continua vendo `/license-expired` ao tentar logar.
4. **Não deleta os dados.**

## Como reativar (cliente regularizou)

1. Em `/admin/tenants` → encontre o tenant suspenso.
2. Clique em **"Reativar"**.
3. **Renove a licença** (passo anterior) — não reativa sem licença válida.

## Como deletar (churn confirmado)

> **Cuidado:** deleção é **irreversível**. Faça backup antes.

1. Em `/admin/tenants` → encontre o tenant a ser removido.
2. **Backup dos dados:**
   ```bash
   # Backup do SQLite do tenant (contatos + agendamentos + audit)
   sudo sqlite3 /opt/evosync/evosync-web/data/evosync.db \
     ".backup '/var/backups/evosync/deleted-${SLUG}-$(date +%F).db'"
   ```
3. **Parar a Evolution API do tenant:**
   ```bash
   docker stop evo_${SLUG} && docker rm evo_${SLUG}
   docker volume rm evo_${SLUG}_instances
   ```
4. **Remover database do Postgres:**
   ```bash
   docker exec -it disparofacil_postgres psql -U evolution \
     -c "DROP DATABASE evo_${SLUG};"
   ```
5. **Deletar nginx vhost (se tiver):**
   ```bash
   sudo rm /etc/nginx/sites-enabled/evo-${SLUG}
   sudo certbot delete --cert-name evo-${SLUG}.seudominio.com
   sudo systemctl reload nginx
   ```
6. **Deletar tenant no admin:**
   - `/admin/tenants` → **"Deletar"** (confirmação dupla).
   - Cascade: contatos, agendamentos, sent_log, audit log são removidos.
7. **Atualizar planilha de cobrança:** marcar como `cancelado` em `__/__/____`.

> **Por que backup?** O cliente pode voltar ("efeito sazonalidade").
> Mantenha o backup por **90 dias** antes de deletar permanentemente.

## Relatório mensal (MRR + Churn)

Todo dia 1 do mês, calcular:

| Métrica | Fórmula |
|---|---|
| **MRR (Monthly Recurring Revenue)** | Σ (valor mensal × tenants ativos) |
| **Tenants ativos** | COUNT(tenants WHERE status = 'active') |
| **Tenants suspensos** | COUNT(tenants WHERE status = 'suspended') |
| **Churn rate mensal** | (tenants que saíram no mês) / (ativos no início do mês) |
| **Novos no mês** | COUNT(tenants WHERE created_at >= início do mês) |

Anote em uma planilha histórica pra acompanhar tendência.

## Templates de mensagem

### Aviso T-7 (7 dias antes do vencimento)

```text
Oi <NOME>! 👋

Passando pra avisar que sua mensalidade do EvoSync vence em <DATA> (7 dias).

Valor: R$ <VALOR>
Forma de pagamento: <PIX/BOLETO/TRANSF>

Dados para pagamento:
<INSERIR DADOS>

Qualquer dúvida, estou por aqui. Obrigado! 🙏
```

### Aviso T+0 (no dia do vencimento)

```text
Oi <NOME>! 👋

Sua mensalidade do EvoSync vence hoje (<DATA>). Ainda não identifiquei
o pagamento. Pode confirmar se já foi feito?

Se preferir, segue os dados para pagamento:
<INSERIR DADOS>
```

### Aviso T+2 (2 dias após vencimento)

```text
Oi <NOME>, tudo bem?

Notei que a mensalidade do EvoSync venceu em <DATA> e ainda não recebi o
pagamento. Seu acesso será suspenso em 5 dias se não regularizar.

Para renovar agora: <DADOS_PAGAMENTO>

Estou à disposição se tiver alguma dificuldade.
```

### Aviso T+7 (suspensão)

```text
Oi <NOME>, infelizmente precisei suspender seu acesso ao EvoSync
por falta de pagamento da mensalidade de <MÊS>.

Para reativar: <DADOS_PAGAMENTO>

Seus dados estão preservados. Assim que regularizar, reativo em alguns minutos.
```

## Próximas evoluções (sugestões para v2)

- **Stripe / PagSeguro / Mercado Pago** para cobrança automática.
- **Lembretes automáticos** (T-7, T+0, T+7) por e-mail/WhatsApp via cron + API.
- **Boleto automático** com confirmação de pagamento.
- **Painel admin "Cobrança"** com lista de inadimplentes em destaque.

## Links relacionados

- [[ADR-004-Modelo-SaaS-Hospedado]] — modelo de negócio (mensalidade fixa)
- [[Runbook-Onboarding-Cliente]] — quando cadastrar a cobrança (T-7 após onboarding)
- [[Runbook-Suporte-Diagnostico]] — quando cliente diz "não consigo entrar" (pode ser license expirada)
- [[Deploy-VPS]] — onde os dados ficam (SQLite, backup)
