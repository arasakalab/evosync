---
tipo: runbook
tags: [evosync, runbook, admin, reset, danger-zone, interno]
criado: 2026-06-14
status: ativo
publico-alvo: interno
---

# Runbook — Reset de Banco de Dados

> **Quem usa:** você (super_admin) quando precisa zerar o banco de dados.
> **Onde:** `/admin/settings` no painel administrativo.
> **Cuidado:** esta operação é **destrutiva e irreversível**. Há backup automático,
> mas prossiga apenas se tiver certeza.

## Quando usar

- Demo / ambiente de teste que precisa ser zerado
- Após um incidente grave (dados corrompidos, import errado em massa)
- Antes de uma migração grande (re-zerar pra começar do zero)
- Reset de performance após muitos anos de uso (DB inflado)

**NÃO use** para:
- Apagar um tenant específico → use `/admin/tenants` → suspender/deletar
- Apagar um convite → use `/admin/invites` → revogar
- Resetar senha de usuário → use [[Runbook-Suporte-Diagnostico]] → "Esqueci senha"

## O que é zerado vs preservado

| Mantido | Apagado |
|---|---|
| ✅ Todos os super admins (você continua logado) | ❌ Tenants (empresas) |
| ✅ Arquivos de mídia em `data/uploads/` | ❌ Owners e operators |
| | ❌ Licenças, convites |
| | ❌ Contatos, listas de contatos, seleções |
| | ❌ Agendamentos, histórico de envios |
| | ❌ Audit log (recriado com 1 entry do reset) |

## Camadas de segurança (defense in depth)

1. **Sessão válida** de super_admin (cookie NextAuth)
2. **Senha do admin** verificada via bcrypt (proteção contra sessão deixada aberta)
3. **Frase "ZERAR"** digitada manualmente (proteção contra click acidental)
4. **Multi-step dialog** (aviso → confirmação → senha → execução)
5. **Backup automático** criado ANTES de qualquer wipe

Se qualquer uma das camadas falhar → operação abortada, nada acontece.

## Fluxo técnico (backend)

```
POST /api/admin/reset-database
  Body: { password, confirmation: "ZERAR" }

  1. auth() → sessão de super_admin
  2. verifyPassword(input, admin.passwordHash)
  3. confirmation === "ZERAR" (trim)
  4. better-sqlite3 .backup() → ./data/backups/evosync-pre-reset-YYYYMMDD_HHMMSS.db
  5. db.transaction() com deletes em ordem cascade-safe:
       - contactListMembers, contactSelections, contactLists, contacts
       - schedules, sentLog
       - invites, licenses, tenantSettings
       - tenants
       - users WHERE role != 'super_admin'
       - auditLog
  6. INSERT audit log (system.reset_database) com metadata
  7. Return { ok, backupPath }
```

## Como restaurar o backup

Se você zerou e precisa voltar atrás:

```bash
# 1. Pare o serviço
sudo systemctl stop evosync

# 2. Faça backup do estado atual (banco zerado, por segurança)
sudo cp /opt/evosync/evosync-web/data/evosync.db \
        /tmp/evosync-zerado-$(date +%F).db

# 3. Restaure o backup pré-reset
sudo cp /opt/evosync/evosync-web/data/backups/evosync-pre-reset-2026-06-14_153000.db \
        /opt/evosync/evosync-web/data/evosync.db

# 4. Corrija owner/perms
sudo chown evosync:evosync /opt/evosync/evosync-web/data/evosync.db

# 5. Suba de novo
sudo systemctl start evosync
```

> **No Windows / dev local:** substitua o `data/evosync.db` pelo arquivo de backup
> e reinicie `npm run dev`.

## Quando NUNCA fazer reset

- Há clientes B2B ativos usando o sistema → eles perderão TUDO
- Licenças com vencimento futuro → serão perdidas (terão que recadastrar)
- Auditoria em andamento → perderá trilha (apesar do audit do reset ficar registrado)

> **Regra de ouro:** se há qualquer cliente ativo, **delete apenas o tenant específico**
> em `/admin/tenants`. Reset total só em ambiente de dev/demo.

## Arquivos envolvidos

| Arquivo | Função |
|---|---|
| `evosync-web/app/api/admin/reset-database/route.ts` | API POST com validações + backup + wipe |
| `evosync-web/app/admin/(panel)/settings/page.tsx` | Página de Configurações (server) |
| `evosync-web/app/admin/(panel)/settings/reset-database.tsx` | Client component (multi-step dialog) |
| `evosync-web/components/admin/admin-shell.tsx` | Nav "Configurações" (atualizado) |
| `evosync-web/lib/db/index.ts` | Expõe `getRawSqlite()` e `getDbFilePath()` |

## Pós-reset (recomendações)

1. **Logout/login** no admin para sincronizar a sessão
2. **Recriar tenants** com seus slugs originais (se quiser reusar nomes)
3. **Reemitir invites** para os owners anteriores
4. **Verificar** se algum container Evolution de tenant antigo precisa ser recriado
5. **Backup do banco novo** em `/var/backups/evosync/` (já é diário via cron)

## Onde o backup fica

| Ambiente | Path |
|---|---|
| Dev local | `./data/backups/evosync-pre-reset-*.db` (relativo ao cwd do Next.js) |
| VPS (Ubuntu 24.04) | `/opt/evosync/evosync-web/data/backups/evosync-pre-reset-*.db` |

> O backup **NÃO é rotacionado automaticamente**. Limpe manualmente após
> ter certeza de que não precisa mais.

## Logs

Após o reset, a **primeira entry do novo audit log** é:

```json
{
  "action": "system.reset_database",
  "userId": "<id do super_admin>",
  "details": {
    "by": "admin@email.com",
    "byUserId": "...",
    "backupPath": "./data/backups/evosync-pre-reset-2026-06-14_153000.db",
    "preservedRoles": ["super_admin"]
  }
}
```

Isso é **a primeira coisa** que aparece em `/admin/audit` após o reset.

## Links relacionados

- [[ADR-004-Modelo-SaaS-Hospedado]] — modelo de negócio
- [[Runbook-Onboarding-Cliente]] — depois de um reset, use pra re-onboardar
- [[Runbook-Suporte-Diagnostico]] — troubleshooting geral
- [[Seguranca]] — bcrypt + audit log
- [[Deploy-VPS]] — paths e permissões do SQLite
