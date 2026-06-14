---
tipo: doc
tags: [evosync, operacao, seguranca, lgpd]
criado: 2026-06-14
status: ativo
origem: evosync-web/docs/SECURITY.md
---

# Segurança — EvoSync

> Importado de `evosync-web/docs/SECURITY.md`. Complementa [[Deploy-VPS]] (que
> cobre hardening de sistema) com o modelo de ameaças da aplicação.

## Modelo de ameaças

EvoSync é um SaaS multi-tenant que armazena credenciais de WhatsApp por cliente
e envia mensagens em massa. Os principais riscos:

| Vetor | Impacto | Mitigação |
|---|---|---|
| Brute-force em login | Account takeover | Rate limit por email (5/15min) + bcrypt cost 10 + audit log |
| Brute-force em invite accept | Account takeover | Rate limit por IP (10/h) + token single-use + expira em 7d |
| XSS via template de mensagem | Account takeover de operador | React escapa por padrão; `dangerouslySetInnerHTML` não usado |
| CSRF em mutações | Mudança de dados | NextAuth csrfToken + SameSite cookies |
| SQL injection | DB compromise | Drizzle ORM usa prepared statements; sem raw SQL |
| RCE via upload | Server takeover | Uploads validados; sem exec de user files |
| Vazamento de API key Evolution | Mensagens não-autorizadas | AES-256-GCM em repouso + `ENCRYPTION_KEY` em `.env` (0600) + redact no log |
| Tenant A ver dados de Tenant B | Privacidade | Todas queries filtradas por `tenantId` da session + RBAC |
| Super admin abusivo | Privacidade | Único super_admin inicial; novos precisam de invite manual; audit log de tudo |
| DDoS | Indisponibilidade | nginx rate limit + ufw + systemd Restart=always |
| Disco cheio | Indisponibilidade | SQLite backup rotativo + journald rate limit |

## O que é criptografado

- **`tenants.evoApiKeyEncrypted`** — API key da Evolution API por tenant.
  - Algoritmo: AES-256-GCM
  - Key: `ENCRYPTION_KEY` em `.env` (32 bytes = 64 hex chars)
  - Formato: `iv:ciphertext:tag` (base64)
  - Gerado por `lib/crypto.ts`
- **`AUTH_SECRET`** — usado pelo NextAuth pra assinar JWTs (HS256).
  - 32+ bytes base64
  - Se vazar, todos os tokens podem ser forjados → **rotacionar e forçar re-login**

## O que **NÃO** é criptografado

- Senhas de usuários (em repouso): bcrypt hash (cost 10) — **não é criptografia reversível**
- Email/nome: dados públicos, não precisam
- Mensagens enviadas: não são armazenadas (apenas o `sent_log` com os números)
- Audit log: em texto puro (pra busca); **redact** automático no logger pra campos sensíveis

## Boas práticas pro super admin

1. **Use 2FA** no email da conta super_admin (recovery é via email)
2. **Não compartilhe** a senha — emita um invite de "owner" pra você mesmo num tenant
3. **Monitore** `/admin/audit` semanalmente, especialmente:
   - `auth.login.failed` (possível brute-force)
   - `invite.created` (verifique se foi você)
   - `tenant.suspended` / `license.extended`
4. **Rotacione** `AUTH_SECRET` a cada 90 dias (força re-login de todos)
5. **Backup** semanal do `/var/backups/evosync/` off-site (S3, B2, etc)
6. **Atualize** com `bash install_vps.sh --update` mensalmente

## Reportar vulnerabilidade

Email: `security@arasakalab.com.br` (placeholder — ajuste pro seu domínio)

Responderemos em até 48h.

## Links relacionados

- [[Deploy-VPS]] — hardening de sistema (systemd, ufw, nginx)
- [[Visao-Geral]] — arquitetura (multi-tenancy)
- [[ADR-001-Contatos-Organizados]] — opt-out (LGPD/anti-ban)
- [[Modulo-Contatos-Web]] — fluxo de opt-out na UI
