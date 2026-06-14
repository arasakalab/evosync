---
tipo: runbook
tags: [evosync, runbook, suporte, diagnostico, troubleshooting, interno]
criado: 2026-06-14
status: ativo
publico-alvo: interno
---

# Runbook — Suporte / Diagnóstico

> **Quem usa:** você (super_admin) ao receber reclamação de cliente.
> **Objetivo:** diagnóstico rápido por sintoma → ação corretiva.
> **Princípio:** escute o sintoma do cliente, identifique a categoria, siga o playbook.

## Comando de diagnóstico rápido (rodar 1º)

```bash
# Status geral do EvoSync
sudo systemctl status evosync
sudo journalctl -u evosync -n 50 --no-pager

# Containers Docker rodando
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health check do app
curl -s https://app.seudominio.com/api/health | jq

# Disco e memória
df -h / /var
free -h
```

> Cole a saída no ticket / resposta pro cliente. Resolve 60% dos casos.

---

## Sintoma 1: "Não consigo enviar mensagens"

### 1.1. Cliente vê erro 401/403

**Causa provável:** API key da Evolution está errada, ou foi rotacionada.

**Diagnóstico:**
```bash
# 1. Verificar se a chave no admin bate com a do container
docker exec evo_<slug> env | grep AUTHENTICATION_API_KEY

# 2. Comparar com a chave salva no admin
#    /admin/tenants → <tenant> → Configurações Evolution
#    (a chave é criptografada — você não consegue ler pelo admin)
```

**Ação:**
- Se a chave foi rotacionada por acidente: peça pro cliente regravar a chave
  na aba **Conexão** do app.
- Se o cliente não tem a chave antiga: gere uma nova:
  ```bash
  docker exec evo_<slug> env  # mostra a chave atual
  # ou
  docker stop evo_<slug>
  # edite o docker run com nova chave (gerada por openssl rand -hex 24)
  docker start evo_<slug>
  ```
- Atualize no admin e envie pro cliente.

> ⚠️ **Sinal de ban:** se a chave está correta e mesmo assim dá 401, **o número do WhatsApp foi banido**. Pare o tenant imediatamente. Ver [[Seguranca]].

### 1.2. Cliente vê erro 500 / "Internal Server Error"

**Causa provável:** bug no envio, ou Evolution API caiu.

**Diagnóstico:**
```bash
# Ver logs do EvoSync
sudo journalctl -u evosync --since "10 minutes ago" | grep -i error

# Ver logs do container Evolution
docker logs evo_<slug> --tail 100
```

**Ação:**
- Se for "ECONNREFUSED 127.0.0.1:8080" → Evolution caiu. Reiniciar:
  ```bash
  docker restart evo_<slug>
  ```
- Se for "Database connection error" → Postgres caiu. Reiniciar tudo:
  ```bash
  docker restart disparofacil_postgres
  sleep 10
  docker restart evo_<slug>
  ```

### 1.3. Cliente vê "Daily limit atingido"

**Causa:** limite diário de envios foi atingido.

**Ação:**
- Explicar o porquê ([[Seguranca]] → warm-up).
- Sugerir aumentar gradualmente (não dobrar de uma vez).
- Ajustar limite diário na config do tenant (em `/admin/tenants` → "Configurações").

---

## Sintoma 2: "Sumiram meus contatos"

### 2.1. Cliente recarregou a página e nada aparece

**Causa provável:** sessão expirou, ou o cliente está olhando o modo errado (Selecionados em vez de Todos).

**Diagnóstico (sem precisar de acesso SSH):**
- Pedir pro cliente ir em **Contatos** → alternar para modo **"Todos"**.
- Se aparecer: era a seleção de envio (ver [[Modulo-Contatos-Web]]).
- Se não aparecer: pular para 2.2.

### 2.2. Contatos realmente sumiram do banco

**Causa provável:** alguém rodou "Limpar tudo", ou migration corrompeu dados.

**Diagnóstico:**
```bash
# Verificar se os dados ainda estão no SQLite
sudo sqlite3 /opt/evosync/evosync-web/data/evosync.db \
  "SELECT COUNT(*) FROM contacts WHERE tenant_id = '<tenant_id>';"
```

**Ação — restaurar do backup:**
```bash
# Listar backups disponíveis
ls -lh /var/backups/evosync/

# Escolher o backup mais recente ANTES do problema
# Parar o serviço
sudo systemctl stop evosync

# Restaurar
sudo cp /var/backups/evosync/evosync-2026-06-XX-HHMM.db \
        /opt/evosync/evosync-web/data/evosync.db
sudo chown evosync:evosync /opt/evosync/evosync-web/data/evosync.db

# Subir
sudo systemctl start evosync
```

> **Pós-ação:** investigar por que os contatos sumiram. Ver audit log:
> `/admin/audit` → filtrar por `tenant_id` → procurar ação `contacts.cleared`.

---

## Sintoma 3: "WhatsApp caiu / desconectou"

**Causa provável:** WhatsApp reiniciou no celular, sessão expirou (> 14 dias
sem uso), ou o celular ficou sem internet.

**Diagnóstico:**
```bash
# Verificar status da instância
curl -s http://localhost:<porta>/instance/connectionState/<instance_name> \
  -H "apikey: $API_KEY" | jq
```

**Ação:**
- Se `state: "close"`:
  - Pedir pro cliente re-escanear o QR code:
    - Aba **Conexão** no app do cliente.
  - Se o cliente não consegue gerar QR novo:
    ```bash
    # Forçar logout e pedir reconexão
    curl -X DELETE http://localhost:<porta>/instance/logout/<instance_name> \
      -H "apikey: $API_KEY"
    curl -X POST http://localhost:<porta>/instance/connect/<instance_name> \
      -H "apikey: $API_KEY"
    ```
- Se o cliente relata que o WhatsApp Business foi desinstalado ou trocou de
  celular: precisa re-escanear **obrigatoriamente** (não tem como restaurar
  sessão automaticamente).

---

## Sintoma 4: "Mensagem não chega"

### 4.1. Cliente diz que enviou mas destinatário não recebeu

**Diagnóstico:**
- Verificar se o envio aparece como ✅ no histórico do app.
- Pedir pro destinatário verificar:
  - Arquivo de conversas arquivadas.
  - Bloqueios (se cliente foi bloqueado pelo destinatário, é falha externa).
  - Número está correto/com DDI.

### 4.2. Mensagem fica "pending" / "queued"

**Causa:** `daily_limit` atingido ou Evolution sobrecarregado.

**Ação:**
- Esperar e ver se processa (delay pode ser alto).
- Se persistir > 1h: reiniciar Evolution (ver 1.2).

---

## Sintoma 5: "Erro 401/403" (sinal de BAN)

> ⚠️ **Este é o caso mais sério.** WhatsApp baniu o número.

**Sinais:**
- Evolution API retorna 401/403 em todas as requisições.
- Cliente relata que o WhatsApp mostra "Este número não pode usar o WhatsApp".
- `connectionState` retorna "banned".

**Ação imediata:**
1. **Pare todos os envios** do tenant:
   - Em `/admin/tenants` → "Pausar envios" (se implementado) ou suspender.
2. **Suspenda a licença** se necessário (evita cliente continuar tentando).
3. **Oriente o cliente:**
   - WhatsApp pode banir contas que violam os termos.
   - Apelidamos para o suporte do WhatsApp: `https://www.whatsapp.com/contact/forms/270250809472048`
   - **Não há garantia de reversão.**
4. **Documente o incidente** no audit log:
   - `/admin/audit` → "Nova entrada" → tipo: `incident.ban`.

**Prevenção** (reforce com o cliente):
- Respeitar limite diário (warm-up).
- Não enviar mensagens idênticas.
- Respeitar opt-out.
- Não usar número comercial novo.

---

## Sintoma 6: "Não consigo entrar no sistema"

### 6.1. Cliente foi suspenso por falta de pagamento

- Veja [[Runbook-Cobranca-Licenca]] → seção "Como reativar".

### 6.2. Cliente esqueceu a senha

```bash
# No servidor, redefinir senha do cliente
cd /opt/evosync/evosync-web
sudo -u evosync npx tsx -e "
import { getDb, schema } from './lib/db';
import { hashPassword } from './lib/password';
import { eq } from 'drizzle-orm';
const db = getDb();
const h = await hashPassword('nova-senha-123');
db.update(schema.users).set({ passwordHash: h })
  .where(eq(schema.users.email, 'cliente@email.com')).run();
console.log('senha resetada');
"
```

> **Recomendação:** peça pro cliente trocar a senha no próximo login.

### 6.3. Cliente nunca recebeu o invite

- Reemitir invite em `/admin/invites` → "Novo convite" para o mesmo e-mail.
- O convite anterior é auto-revogado.

---

## Sintoma 7: "App está lento / travando"

**Diagnóstico:**
```bash
# Recursos da VPS
free -h
df -h
top -bn1 | head -20

# Tamanho do banco do cliente
sudo sqlite3 /opt/evosync/evosync-web/data/evosync.db \
  "SELECT COUNT(*) FROM contacts WHERE tenant_id = '<id>';"
```

**Ações por causa:**
- **Memória cheia:** VPS 2 GB aguenta ~5-10 tenants. Se chegou no limite:
  upgrade da VPS ou migrar pra Postgres.
- **Disco cheio:** `sent_log.json` crescendo, ou backups antigos:
  ```bash
  sudo find /var/backups/evosync -mtime +30 -delete
  ```
- **Muitos contatos (>50k):** `JSON_EXTRACT` fica lento. Ver
  [[Modulo-Contatos-Web]] → Riscos → considerar normalizar.

---

## Sintoma 8: "Audit log / página /admin/audit está vazia"

**Causa:** logger não está persistindo, ou ninguém clicou nas ações instrumentadas.

**Diagnóstico:**
```bash
# Logs do app
sudo journalctl -u evosync --since "today" | grep audit
```

**Ação:**
- Se logs OK mas tabela `audit_log` vazia: pode ser migration não rodada.
  ```bash
  cd /opt/evosync/evosync-web
  sudo -u evosync npm run db:migrate
  ```

---

## Quando escalar / pedir ajuda

Se nenhum playbook acima resolveu:

1. **Coletar diagnóstico completo:**
   - Output do "Comando de diagnóstico rápido" (topo deste arquivo).
   - Output de `docker logs evo_<slug> --tail 200`.
   - Output de `sudo journalctl -u evosync -n 200`.
   - Screenshots do erro no app do cliente.
2. **Verificar issues conhecidas** em
   `https://github.com/arasakalab/evosync/issues` (placeholder).
3. **Abrir ticket interno** com tudo acima.

## Pós-suporte (sempre)

Após resolver, registre:
- O sintoma (palavras do cliente).
- A causa raiz.
- A solução aplicada.
- Tempo total até resolver.

Use para alimentar uma base de "perguntas frequentes" e priorizar melhorias no produto.

## Links relacionados

- [[Seguranca]] — modelo de ameaças, criptografia, anti-ban
- [[Deploy-VPS]] — infraestrutura
- [[Runbook-Onboarding-Cliente]] — fluxos esperados
- [[Runbook-Cobranca-Licenca]] — quando o sintoma é "license expirada"
- [[ADR-004-Modelo-SaaS-Hospedado]] — você é o SPOF
