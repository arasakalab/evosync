---
tipo: runbook
tags: [evosync, runbook, restore, sqlite, interno, danger-zone]
criado: 2026-06-14
status: ativo
publico-alvo: interno
---

# Runbook — Restaurar Banco de Dados

> **Quem usa:** você (super_admin) quando precisa voltar o banco a um estado anterior.
> **Onde:** `/admin/settings` → card "Restaurar".
> **Cuidado:** operação **destrutiva e irreversível**. O banco atual é substituído
> pelo arquivo enviado. Backup automático é criado antes.

## Quando usar

- Disaster recovery (banco corrompido, dado estragado por bug)
- Reverter para um estado conhecido (rollback de deploy)
- Importar dados de outro ambiente EvoSync
- Testar backup em outro local ("será que esse arquivo abre?")

**NÃO use** para:
- Restaurar 1 tenant específico → use `/admin/tenants` (delete + recriar)
- Zerar tudo → use [[Runbook-Reset-Banco]]
- Fazer backup → use [[Runbook-Backup-Banco]]

## Pré-requisitos

- Arquivo `.db` criado pelo EvoSync (via [[Runbook-Backup-Banco]] ou pelo cron diário)
- Arquivo ≤ **500MB**
- Arquivo contém **pelo menos 1 super admin** (proteção contra lock-out)

## Como funciona (UI)

1. Acesse `/admin/settings`
2. Role até o card "**Restaurar**" (entre Backup e Zona de perigo)
3. **Arraste o .db** pra zona de upload, ou clique pra escolher
4. O sistema **inspeciona** automaticamente (`POST /api/admin/inspect-backup`)
   - Mostra: tamanho, tabelas, contagens, super admins encontrados
   - Botão "Restaurar este backup" só ativa se válido
5. Clique em "**Restaurar este backup**"
6. Modal multi-step (mesma defesa do reset):
   - **Step 1: Aviso** — preview do que será restaurado + lista de super admins
   - **Step 2: Confirmação** — digite `RESTAURAR` + sua senha
   - **Step 3: Sucesso** — path do backup do estado anterior
7. **Logout/login** recomendado

## Camadas de segurança (defense in depth)

1. **Sessão** de super_admin
2. **Inspeção read-only** no upload (cliente vê o conteúdo antes de confirmar)
3. **Validação server-side** repetida no momento do restore (não confia no cliente):
   - Tamanho ≤ 500MB
   - Magic bytes `SQLite format 3\0`
   - 12 tabelas obrigatórias presentes
   - ≥ 1 super admin no arquivo
4. **Senha** do admin (bcrypt verify)
5. **Frase `RESTAURAR`** digitada
6. **Backup automático** do estado atual ANTES da troca

## Fluxo técnico (backend)

```
POST /api/admin/restore-database (multipart: database, password, confirmation)
  │
  ├─ 1. auth() → super_admin
  ├─ 2. parse FormData
  ├─ 3. validate size (≤ 500MB)
  ├─ 4. confirm typed ("RESTAURAR")
  ├─ 5. verifyPassword(input, admin.passwordHash)
  ├─ 6. save upload em /tmp/evosync-upload-*.db
  ├─ 7. validateBackupFile(tmp):
  │     - magic bytes
  │     - tabelas obrigatórias
  │     - contagens
  │     - ≥ 1 super admin
  ├─ 8. backup estado atual → data/backups/evosync-pre-restore-TIMESTAMP.db
  │     (better-sqlite3 .backup)
  ├─ 9. resetDb() — fecha conexão + limpa cache
  ├─ 10. remove evosync.db-wal e evosync.db-shm (stale)
  ├─ 11. copy upload → evosync.db.new → atomic rename → evosync.db
  ├─ 12. chmod 600
  ├─ 13. audit log entry: system.restore_database
  │
  └─ ⚠️  Entre passos 9-11: queries em voo falham
       (janela de indisponibilidade curta)
```

## Endpoint separado de inspeção (UX)

```
POST /api/admin/inspect-backup (multipart: database)
  → { valid, reason?, fileSize, tables, counts, superAdminEmails }

  Lê o arquivo, valida e retorna metadados.
  NÃO modifica nada. Read-only.

  Usado pelo cliente para mostrar preview ANTES de confirmar o restore.
  A validação é RE-EXECUTADA no /restore-database (defense in depth).
```

## Por que 2 endpoints?

| Inspect | Restore |
|---|---|
| Read-only | Destructive |
| Sem senha | Com senha |
| Sem confirmação | Com frase |
| Retorna metadados | Faz o swap |
| Re-validável quantas vezes quiser | One-shot |

O `inspect` deixa o usuário **ver antes de fazer** —peace of mind.

## O que acontece com outros usuários durante o restore

- Sessões JWT continuam válidas até expirar (8h padrão)
- Mas as queries vão falhar momentaneamente durante o swap
- Após o swap, todas as sessões precisam **relogar** (porque o DB mudou)
- Recomende aos usuários: "logout/login após o admin restaurar"

## Validação de "lock-out" (proteção crítica)

O `validateBackupFile` **rejeita** o arquivo se:
- Não contém nenhuma linha em `users WHERE role = 'super_admin'`

Por quê: restaurar um arquivo sem super admins trancaria TODOS os admins
para fora (eles não conseguiriam logar). O check é feito tanto no inspect
quanto no restore (defense in depth).

## Onde os backups ficam

| Backup | Path |
|---|---|
| Estado anterior (criado durante restore) | `./data/backups/evosync-pre-restore-YYYY-MM-DD_HHMMSS.db` |
| Pré-reset (criado por [[Runbook-Reset-Banco]]) | `./data/backups/evosync-pre-reset-YYYY-MM-DD_HHMMSS.db` |
| Automático da VPS (cron diário) | `/var/backups/evosync/evosync-YYYY-MM-DD-HHMM.db` |

> **NÃO são rotacionados automaticamente.** Limpe manualmente após ter
> certeza de que não precisa mais.

## Como desfazer um restore mal feito

Se você restaurou e quer voltar ao estado DEPOIS do restore (ou seja, voltar
ao que estava antes do restore):

```bash
# 1. Pegue o backup pré-restore
ls -la data/backups/evosync-pre-restore-*.db | tail -1

# 2. Use o botão "Restaurar" no admin (com esse arquivo)
#    ou via SSH:
sudo systemctl stop evosync
sudo cp data/backups/evosync-pre-restore-XXXX.db \
        /opt/evosync/evosync-web/data/evosync.db
sudo chown evosync:evosync /opt/evosync/evosync-web/data/evosync.db
sudo systemctl start evosync
```

## Arquivos envolvidos

| Arquivo | Função |
|---|---|
| `evosync-web/lib/db/index.ts` | `resetDb()` (close + clear cache) |
| `evosync-web/lib/admin/backup-validation.ts` | `validateBackupFile()` (compartilhado) |
| `evosync-web/app/api/admin/inspect-backup/route.ts` | Preview read-only do upload |
| `evosync-web/app/api/admin/restore-database/route.ts` | Restore destrutivo (multipart) |
| `evosync-web/app/admin/(panel)/settings/restore-database.tsx` | Client component (drag-drop + multi-step) |
| `evosync-web/app/admin/(panel)/settings/page.tsx` | Integra o card "Restaurar" |

## Pós-restore (recomendações)

1. **Logout/login** no admin
2. **Notifique** os usuários que precisam relogar
3. Verifique `/admin/audit` — a primeira entry deve ser `system.restore_database`
4. Confirme que o backup pré-restore está em `data/backups/`
5. Após algumas horas de uso normal, se tudo OK, pode deletar o backup

## Links relacionados

- [[Runbook-Backup-Banco]] — gerar o .db antes de precisar restaurar
- [[Runbook-Reset-Banco]] — wipe total (caso restore não baste)
- [[Deploy-VPS]] — paths e permissões do SQLite
- [[Seguranca]] — bcrypt + audit
