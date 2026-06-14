---
tipo: runbook
tags: [evosync, runbook, onboarding, cliente, interno, saas]
criado: 2026-06-14
status: ativo
publico-alvo: interno
tempo-estimado: 15-20min
---

# Runbook — Onboarding de Cliente B2B

> **Quem usa:** você (super_admin do EvoSync).
> **Quando:** um novo cliente te contrata (WhatsApp, e-mail, formulário).
> **Objetivo:** entregar pro cliente o app + Evolution API dele funcionando, em ~15-20 min.

## Pré-requisitos

- VPS com EvoSync já instalado ([[Deploy-VPS]]).
- Acesso SSH como root na VPS.
- Acesso ao `/admin` como super_admin.
- DNS wildcard configurado: `*.evo.seudominio.com` → IP da VPS (recomendado).
- Portas liberadas: 22 (SSH), 80/443 (nginx), 3000 (app), 8080+ (Evolution).

## Visão geral do fluxo

```
A. Coletar dados do cliente
        ↓
B. Provisionar Evolution API dedicada (Docker)
        ↓
C. Criar tenant no admin panel
        ↓
D. (Opcional) Configurar credenciais Evolution do tenant
        ↓
E. Emitir invite
        ↓
F. Entregar acesso pro cliente (mensagem padrão)
        ↓
G. Validar conexão
        ↓
H. Cadastrar em [[Runbook-Cobranca-Licenca]]
```

---

## A. Coletar dados do cliente

Anote em uma planilha ou ticket:

```markdown
- [ ] Nome do responsável: _______________
- [ ] Empresa: _______________
- [ ] E-mail (será o login): _______________
- [ ] WhatsApp do responsável: _______________
- [ ] Slug do tenant (sem espaços, lowercase): _______________
- [ ] Plano contratado: _______________
- [ ] Valor mensal: R$ _______________
- [ ] Vencimento da primeira mensalidade: __/__/____
```

> **Convenção de slug:** `acme`, `padaria-joao`, `imobiliaria-sp`. Sem acentos, sem espaços, sem caracteres especiais. Será usado para porta, container, banco e domínio.

---

## B. Provisionar Evolution API dedicada

> **Premissa:** você já tem uma rede Docker `evolution-shared` com Postgres + Redis
> rodando (instalada junto com o EvoSync em [[Deploy-VPS]]). Se ainda não tem,
> adapte os comandos para criar um `compose.yaml` standalone para esse tenant.

### B.1. Escolher porta única

Use a próxima porta livre. Padrão sugerido:

| Tenant # | Porta |
|---|---|
| 1 | 8080 |
| 2 | 8081 |
| 3 | 8082 |
| ... | ... |

Anote: porta do tenant atual = **__________**

### B.2. Criar database no Postgres

```bash
# Entrar no container postgres
docker exec -it disparofacil_postgres psql -U evolution

# Dentro do psql:
CREATE DATABASE evo_<slug>;
GRANT ALL PRIVILEGES ON DATABASE evo_<slug> TO evolution;
\q
```

### B.3. Subir container Evolution do tenant

```bash
TENANT=<slug>
PORT=<porta>
API_KEY=$(openssl rand -hex 24)

# Salvar a chave (você vai precisar copiar pro admin)
echo "TENANT=$TENANT"
echo "PORT=$PORT"
echo "API_KEY=$API_KEY"

docker run -d \
  --name "evo_${TENANT}" \
  --network evolution-shared \
  --restart unless-stopped \
  -p ${PORT}:8080 \
  -e SERVER_URL="http://localhost:${PORT}" \
  -e AUTHENTICATION_API_KEY="${API_KEY}" \
  -e DATABASE_ENABLED=true \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI="postgresql://evolution:${POSTGRES_PASSWORD}@postgres:5432/evo_${TENANT}" \
  -e DATABASE_SAVE_DATA_INSTANCE=true \
  -e DATABASE_SAVE_DATA_NEW_MESSAGE=true \
  -e DATABASE_SAVE_MESSAGE_UPDATE=true \
  -e DATABASE_SAVE_DATA_CONTACTS=true \
  -e DATABASE_SAVE_DATA_CHATS=true \
  -e DATABASE_SAVE_DATA_LABELS=true \
  -e DATABASE_SAVE_DATA_HISTORIC=true \
  -e CACHE_REDIS_ENABLED=true \
  -e CACHE_REDIS_URI="redis://redis:6379/1" \
  -e CACHE_REDIS_PREFIX_KEY="evo_${TENANT}_v2" \
  -v "evo_${TENANT}_instances:/evolution/instances" \
  evoapicloud/evolution-api:latest
```

> Substitua `${POSTGRES_PASSWORD}` pela senha do Postgres (em `/opt/evosync/infra/evolution/.env` ou similar).

### B.4. (Opcional) Subdomínio + nginx

Se você configurou DNS wildcard, adicione um server block nginx:

```nginx
# /etc/nginx/sites-available/evo-<slug>
server {
  listen 80;
  server_name evo-<slug>.seudominio.com;
  client_max_body_size 50M;

  location / {
    proxy_pass http://127.0.0.1:<porta>;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/evo-<slug> /etc/nginx/sites-enabled/
sudo certbot --nginx -d evo-<slug>.seudominio.com
sudo nginx -t && sudo systemctl reload nginx
```

### B.5. Testar Evolution

```bash
# Substituir pela API key gerada
curl -s http://localhost:<porta>/ \
  -H "apikey: $API_KEY" | jq
```

Deve retornar `{"status":"SUCCESS","message":"Welcome to the Evolution API"}`.

---

## C. Criar tenant no admin

1. Acesse `https://app.seudominio.com/admin/login` (ou `https://evo.seudominio.com/admin/login`).
2. Login como super_admin.
3. Vá em `/admin/tenants` → **"Nova empresa"**.
4. Preencha:
   - **Nome:** empresa do cliente
   - **Slug:** o mesmo do passo B (ex: `acme`)
   - **E-mail do owner:** e-mail coletado
5. Clique em **Criar**. Sistema:
   - Cria o tenant.
   - Cria automaticamente uma **licença de 30 dias** (a partir de hoje).
   - Redireciona para a página do tenant.

---

## D. Configurar credenciais Evolution do tenant

> **Por quê:** quando o cliente logar pela primeira vez, o app precisa saber
> a URL e API key da Evolution dele. Há 2 caminhos.

### Caminho D.1 — Cliente configura sozinho (recomendado)

**Não faça nada aqui.** O cliente vai seguir o [[Guia-Cliente-Primeiros-Passos]]
e colar a URL + API key dele na aba **Conexão** do app.

> Nesse caminho, você só precisa entregar a URL e a API key pro cliente
> (passo F). As creds vão ser criptografadas em
> `tenants.evoApiKeyEncrypted` no momento que ele salvar (ver [[Seguranca]]).

### Caminho D.2 — Você configura pra ele (avançado)

Se o cliente tiver dificuldade, faça você mesmo:

1. No admin, vá em `/admin/tenants` → clique no tenant.
2. Em "Configurações Evolution", preencha:
   - `EVO_URL`: `https://evo-<slug>.seudominio.com` (ou `http://IP:<porta>`)
   - `EVO_APIKEY`: a chave gerada no passo B.3
3. Salvar. Sistema criptografa e armazena.

---

## E. Emitir invite

1. No admin, vá em `/admin/invites` → **"Novo convite"**.
2. Preencha:
   - **Tenant:** o que você acabou de criar.
   - **E-mail:** o e-mail do cliente.
   - **Função:** `owner` (dono do tenant, acesso total).
   - **Expira em:** 7 dias (padrão).
3. Clique em **Gerar convite**.
4. **Copie o link** gerado (formato: `https://app.seudominio.com/invite/<token>`).

> O token é single-use. Se o cliente perder o link, gere outro (o anterior é auto-revogado).

---

## F. Entregar acesso pro cliente (mensagem padrão)

Use este template (WhatsApp/e-mail) — substitua os placeholders:

```text
Olá <NOME>! 👋

Bem-vindo ao EvoSync! Seu acesso está pronto:

🔗 Link para criar sua senha: <LINK_INVITE>
🌐 Endereço do sistema: <URL_APP>
📱 Endereço da sua Evolution API: <URL_EVOLUTION>
🔑 Sua chave da Evolution API: <API_KEY>

⚠️ Guarde a chave em local seguro. Ela dá acesso ao seu WhatsApp.

📖 Como começar (passo a passo):
<LINK_PARA_GUIA_CLIENTE_PRIMEIROS_PASSOS>

Qualquer dúvida, me chama aqui. Tempo estimado para começar: ~10 min.
```

Substitua:
- `<LINK_INVITE>` pelo link copiado no passo E.
- `<URL_APP>` por `https://app.seudominio.com` ou a URL configurada.
- `<URL_EVOLUTION>` por `https://evo-<slug>.seudominio.com` (ou `http://IP:<porta>`).
- `<API_KEY>` pela chave gerada em B.3.
- `<LINK_PARA_GUIA_CLIENTE_PRIMEIROS_PASSOS>` por link público para
  [[Guia-Cliente-Primeiros-Passos]] (exporte a nota como PDF se necessário).

---

## G. Validar conexão

Após o cliente seguir o guia, valide que está tudo OK:

1. **Admin vê o tenant ativo** em `/admin/tenants` → status "ativo".
2. **Cliente logou?** Veja o último login em `/admin/users` (filtro por tenant).
3. **WhatsApp conectado?** Em `/admin/tenants` → ações → "Testar conexão Evolution" (ou peça pro cliente confirmar que o status da instância está `open`).
4. **Teste de envio?** Crie um contato de teste seu (ex: seu próprio WhatsApp) e peça pro cliente disparar 1 mensagem. Você deve receber.

Se algo falhar, abra o [[Runbook-Suporte-Diagnostico]].

---

## H. Cadastrar em [[Runbook-Cobranca-Licenca]]

1. Abrir a planilha de controle (ou criar entry no admin).
2. Anotar:
   - Tenant, slug, plano, valor mensal, data de vencimento.
3. Configurar lembrete no calendário: **T-7 dias** (notificar cliente sobre renovação).

---

## Checklist de conclusão

- [ ] Tenant criado
- [ ] Evolution API rodando (porta única)
- [ ] Subdomínio + TLS configurados (opcional, recomendado)
- [ ] Invite emitido e enviado pro cliente
- [ ] Cliente logou pela primeira vez
- [ ] WhatsApp do cliente conectado (QR escaneado)
- [ ] Disparo de teste OK
- [ ] Tenant cadastrado em [[Runbook-Cobranca-Licenca]]

## Próximos passos (sua responsabilidade)

- Monitorar uso do tenant (daily_limit, falhas de envio).
- Aplicar patches de segurança ([[Deploy-VPS]] → `bash install_vps.sh --update`).
- Renovar licença mensalmente ([[Runbook-Cobranca-Licenca]]).
- Fazer backup do SQLite do EvoSync (já é diário via cron em [[Deploy-VPS]]).

## Links relacionados

- [[ADR-004-Modelo-SaaS-Hospedado]] — modelo de negócio
- [[Deploy-VPS]] — setup inicial da VPS
- [[Guia-Cliente-Primeiros-Passos]] — passo a passo que o cliente recebe
- [[Runbook-Cobranca-Licenca]] — próximo passo após onboarding
- [[Runbook-Suporte-Diagnostico]] — quando algo dá errado
- [[Seguranca]] — criptografia da API key
