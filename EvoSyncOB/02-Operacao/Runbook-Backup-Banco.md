---
tipo: runbook
tags: [evosync, runbook, backup, sqlite, interno]
criado: 2026-06-14
status: ativo
publico-alvo: interno
---

# Runbook — Backup do Banco de Dados

> **Quem usa:** você (super_admin).
> **Onde:** `/admin/settings` → card "Backup".
> **Quando:** antes de qualquer operação destrutiva ([[Runbook-Reset-Banco]]),
> periodicamente para arquivar, ou antes de deploys grandes.

## Como funciona (UI)

1. Acesse `/admin/settings`
2. Role até o card "**Backup do banco de dados**" (entre "Sua conta" e a "Zona de perigo")
3. Clique em "**Salvar backup em...**" (ou "Baixar backup" se o browser não suporta)
4. Escolha a pasta e o nome do arquivo no diálogo nativo
5. Aguarde o download

**Tempo:** ~1-3 segundos para bancos pequenos (até ~100 MB).

## Estratégias de download (escolha automática por browser)

### 1. File System Access API (Chrome, Edge, Opera 86+)
- **O que faz:** abre o diálogo "Save As" **nativo do sistema operacional**
- **Vantagem:** usuário escolhe a pasta E o nome do arquivo antes do download começar
- **UX:** aparece um selo "Salvar em pasta" no card

### 2. Fallback via `<a download>` (Firefox, Safari, mobile browsers)
- **O que faz:** dispara o download padrão do browser
- **Vantagem:** funciona em qualquer browser moderno
- **Limitação:** alguns browsers salvam direto na pasta de Downloads; o usuário pode escolher "Salvar como" no diálogo
- **Mensagem na UI:** informa o usuário que ele pode usar "Salvar como"

> A detecção é automática via `'showSaveFilePicker' in window`.

## Fluxo técnico (backend)

```
GET /api/admin/backup-database

  1. auth() → sessão de super_admin (cookie NextAuth)
  2. better-sqlite3 .backup(tempPath) → snapshot consistente do SQLite
     (inclui dados pendentes do WAL automaticamente)
  3. fs.createReadStream(tempPath) → stream Node Readable
  4. Readable.toWeb() → converte para Web ReadableStream (Next.js)
  5. Response com headers:
     - Content-Type: application/x-sqlite3
     - Content-Disposition: attachment; filename="evosync-backup-YYYY-MM-DD_HHMMSS.db"
     - Content-Length: <bytes>
     - X-Backup-Size: <bytes> (para a UI mostrar o tamanho)
     - Cache-Control: no-store
  6. Cleanup: temp file apagado ao fim do stream (ou em 60s, safety net)
```

## Compatibilidade

| Browser | Estratégia | Pasta de destino |
|---|---|---|
| Chrome 86+ / Edge 86+ / Opera 72+ | File System Access API | Escolhida pelo user via "Save As" |
| Firefox | `<a download>` fallback | Pasta padrão de Downloads (user pode "Salvar como") |
| Safari (macOS 13+) | `<a download>` fallback | Pasta padrão de Downloads (user pode "Salvar como") |
| Mobile (iOS/Android) | `<a download>` fallback | Arquivos / Downloads do device |

> O snapshot é **idêntico** em todas as estratégias — só o caminho de salvamento muda.

## Como restaurar o backup

### VPS (Ubuntu 24.04)

```bash
# 1. Pare o serviço
sudo systemctl stop evosync

# 2. Backup do estado atual (safety)
sudo cp /opt/evosync/evosync-web/data/evosync.db \
        /tmp/evosync-atual-$(date +%F).db

# 3. Copie o .db baixado para o caminho do banco
#    (você pode usar scp, ou subiu manualmente via SFTP)
sudo cp /caminho/do/seu/evosync-backup-2026-06-14_153000.db \
        /opt/evosync/evosync-web/data/evosync.db

# 4. Corrija permissões
sudo chown evosync:evosync /opt/evosync/evosync-web/data/evosync.db

# 5. Suba o serviço
sudo systemctl start evosync

# 6. Verifique
curl -s https://app.seudominio.com/api/health | jq
```

### Dev local

```bash
# Pare o dev server (Ctrl+C)
# Substitua o arquivo
cp ~/Downloads/evosync-backup-2026-06-14_153000.db \
   ./data/evosync.db

# Suba novamente
npm run dev
```

> **Aviso:** o backup inclui TUDO — tenants, usuários, licenças, contatos,
> agendamentos, audit log. Restaurar = voltar o banco inteiro ao estado do
> snapshot.

## O que está incluído no backup

| Tabela | Incluído? |
|---|---|
| `tenants` | ✅ |
| `users` (todos — incluindo super admins) | ✅ |
| `licenses` | ✅ |
| `invites` (pendentes e usados) | ✅ |
| `contacts`, `contact_lists`, `contact_list_members`, `contact_selections` | ✅ |
| `schedules` | ✅ |
| `sent_log` | ✅ |
| `audit_log` | ✅ |
| `tenant_settings` | ✅ |

**Não incluído:**
- Arquivos de mídia em `data/uploads/` (precisam ser backupeados à parte)
- Container Evolution API (precisa ser recriado se perdido)

> O backup é o **SQLite apenas**. Para backup completo da infra, veja
> [[Deploy-VPS]] → seção "Backup".

## Frequência recomendada

| Cenário | Frequência |
|---|---|
| Produção com clientes ativos | Manual antes de operações destrutivas + confiar no cron diário da VPS |
| Dev / demo | Manual quando for mexer em estrutura |
| Antes de deploy | Manual |

> O cron diário `/etc/cron.daily/evosync-backup` (configurado no install_vps.sh)
> já faz backup automático do SQLite para `/var/backups/evosync/` no servidor.
> O backup daqui é **adicional** — para o admin baixar uma cópia local.

## Segurança

- O backup é gerado num arquivo **temporário** em `os.tmpdir()` e apagado
  automaticamente após o stream ser consumido
- Não fica nenhuma cópia no servidor após o download
- O arquivo temporário tem cleanup via `nodeStream.on("end")` + safety net
  de 60 segundos via `setTimeout(cleanup).unref()`
- A rota exige sessão de **super_admin** (cookie NextAuth)

## Arquivos envolvidos

| Arquivo | Função |
|---|---|
| `evosync-web/app/api/admin/backup-database/route.ts` | API GET que faz o snapshot e stream |
| `evosync-web/app/admin/(panel)/settings/backup-database.tsx` | Client component com File System Access API + fallback |
| `evosync-web/app/admin/(panel)/settings/page.tsx` | Integra o card de backup na página |
| `evosync-web/lib/db/index.ts` | `getRawSqlite()` exposto para `.backup()` |

## Próximas evoluções (backlog)

- [ ] **Agendar backup por e-mail** (anexar o .db num e-mail semanal)
- [ ] **Upload de backup** (interface para subir um .db e restaurar)
- [ ] **Histórico de backups** (mostrar últimos N downloads no card)
- [ ] **Compactar** o .db (gzip on the fly) — útil para bancos grandes

## Links relacionados

- [[Runbook-Reset-Banco]] — usar backup ANTES de resetar
- [[Runbook-Onboarding-Cliente]] — após restaurar um backup, clientes antigos voltam
- [[Deploy-VPS]] — backup automático via cron no servidor
- [[Seguranca]] — criptografia e audit
