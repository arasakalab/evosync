---
tipo: runbook
tags: [evosync, runbook, instalacao, setup, vps, evolution, onboarding, master-guide]
criado: 2026-06-15
status: ativo
publico-alvo: interno
tempo-estimado: 90-120min (do zero ao primeiro tenant)
---

# Guia de Instalação Completa do EvoSync

> **O que é:** Passo a passo único e completo para colocar o EvoSync em produção.
> Vai do **VPS zerado** até o **primeiro cliente B2B disparando mensagens**.
>
> **Quando usar:** primeira instalação, ou quando precisar recriar do zero.
>
> **Pré-requisito de leitura:** nenhum — esse documento é **self-contained**.
> Ele tem links para outros docs do vault onde você pode se aprofundar,
> mas tudo o que precisa saber está aqui.

## TL;DR

```
0. Provisionar VPS Ubuntu 24.04 com DNS configurado
1. Instalar Docker, Node 20, nginx, certbot no servidor
2. Rodar installer/install_vps.sh (instala EvoSync + systemd + backup cron)
3. Configurar DNS wildcard + TLS via certbot
4. Criar super admin inicial
5. Provisionar primeiro tenant (Evolution API) via installer/onboard-tenant.sh
6. Mandar credenciais pro cliente + cliente configura UI
7. Cliente faz primeiro disparo ✅
```

**Tempo total:** 90-120 minutos para primeira instalação completa.
**Custo estimado:** US$ 12-25/mês (VPS 2GB) + US$ 0 (Evolution self-hosted).

---

## Índice

1. [Pré-requisitos](#parte-1-pré-requisitos)
2. [Setup inicial do servidor](#parte-2-setup-inicial-do-servidor)
3. [Instalar o EvoSync](#parte-3-instalar-o-evosync)
4. [Configurar DNS e TLS](#parte-4-configurar-dns-e-tls)
5. [Criar super admin inicial](#parte-5-criar-super-admin-inicial)
6. [Provisionar primeiro tenant/cliente](#parte-6-provisionar-primeiro-tenantcliente)
7. [Configurar o cliente (operator)](#parte-7-configurar-o-cliente-operator)
8. [Manutenção básica](#parte-8-manutenção-básica)
9. [Troubleshooting](#parte-9-troubleshooting)
10. [Apêndice](#apêndice)

---

# Parte 1: Pré-requisitos

## 1.1. VPS / servidor

| Recurso | Mínimo | Recomendado |
|---|---|---|
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | **2 GB** (5-10 tenants) |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 20 GB | 40 GB (SQLite + backups + logs) |
| Acesso | SSH como root (ou sudo) | SSH root |
| IPv4 público | 1 (com porta 80/443/22 liberadas) | Idem |

**Provedores testados:** Hetzner, DigitalOcean, Vultr, AWS Lightsail.

## 1.2. Domínio

Você precisa de um domínio que aponte para o IP do VPS. Recomendado:

```
app.seudominio.com    →  IP_DO_VPS        (A record)
*.evo.seudominio.com  →  IP_DO_VPS        (A record, wildcard)
```

**Por que wildcard?** Cada tenant terá sua própria Evolution API em um subdomínio (`evo-acme.evo.seudominio.com`). Wildcard economiza ter que criar um registro DNS por tenant.

> Se não quiser wildcard, você pode acessar via porta (`http://IP:8081`), mas não é recomendado para produção.

## 1.3. Conhecimentos necessários

Você precisa saber:
- ✅ SSH básico (ssh user@host)
- ✅ Editar arquivos no terminal (vim/nano)
- ✅ Comandos Linux básicos (cd, ls, cat, sudo)
- ✅ Conceitos de DNS (A record, wildcard)
- ✅ Conceitos de HTTPS (Let's Encrypt, certbot)

Você **NÃO** precisa saber:
- ❌ Next.js / React (é a app, não precisa codar)
- ❌ Docker Compose (o installer faz tudo)
- ❌ SQL / Drizzle (o ORM cuida)

---

# Parte 2: Setup inicial do servidor

Conecte no servidor como root:

```bash
ssh root@SEU_IP
```

## 2.1. Atualizar o sistema

```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git ufw ca-certificates
```

## 2.2. Configurar firewall (ufw)

```bash
ufw allow OpenSSH      # 22
ufw allow 'Nginx Full' # 80 + 443
ufw enable
ufw status
```

> **Não** abra as portas 3000, 5432, 8080+ — elas devem ficar **bloqueadas externamente** (só acessíveis via nginx ou localhost).

## 2.3. Instalar Docker

```bash
# Add Docker GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repo
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

## 2.4. Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version  # deve ser v20.x
npm --version
```

## 2.5. Instalar nginx e certbot

```bash
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
```

## 2.6. Criar usuário dedicado (recomendado, mas opcional)

O `install_vps.sh` cria o usuário `evosync` automaticamente. Se você quiser criá-lo manualmente antes:

```bash
useradd --system --shell /usr/sbin/nologin --home /opt/evosync --no-create-home evosync
```

> Pode pular — o installer cria.

---

# Parte 3: Instalar o EvoSync

## 3.1. Clonar o repositório

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/arasakalab/evosync.git
cd evosync
ls -la
# Deve mostrar: installer/, evosync-web/, infra/, main.py, README.md, etc.
```

> Se seu repositório é privado, use o método de auth apropriado (deploy key, token, etc).

## 3.2. Rodar o instalador

```bash
cd /opt/evosync
sudo bash installer/install_vps.sh --domain app.seudominio.com
```

> Substitua `app.seudominio.com` pelo seu domínio real.

**O que o script faz automaticamente** (em ~3-5 minutos):
1. Verifica Ubuntu 24.04
2. Atualiza apt + instala deps (nginx, certbot, sqlite3, ufw, openssl, git)
3. Cria usuário `evosync` (system, sem shell)
4. Roda `npm ci --omit=dev` + `next build`
5. Gera `/opt/evosync/.env` com `ENCRYPTION_KEY` e `AUTH_SECRET` novos (32 bytes cada, hex)
6. Cria unit systemd `evosync.service` (auto-restart, hardened)
7. Configura nginx reverse proxy + WebSocket upgrade
8. Roda `certbot --nginx` para TLS
9. Cria cron diário de backup em `/var/backups/evosync`
10. Habilita ufw (SSH + Nginx Full)
11. Inicia o serviço

### 3.3. Validar que está tudo OK

```bash
# Status do serviço
sudo systemctl status evosync.service

# Health check
curl -s https://app.seudominio.com/api/health | jq
# Esperado: {"status":"ok","db":true,"scheduler":true,"uptime":N,...}

# Logs em tempo real
sudo journalctl -u evosync -f
# Ctrl+C para sair
```

**Esperado ver:**
- `✓ evosync está rodando`
- Endpoint `/api/health` retornando `status: ok`
- Sem erros nos logs

### 3.4. Backup do `.env` (CRÍTICO)

```bash
sudo cat /opt/evosync/.env
# Deve mostrar:
#   DATABASE_URL=./data/evosync.db
#   PORT=3000
#   NODE_ENV=production
#   LOG_LEVEL=info
#   ENCRYPTION_KEY=<64-char hex>
#   AUTH_SECRET=<base64>

# Salve essas chaves em local seguro (1Password, Bitwarden, etc).
# Se você perder o ENCRYPTION_KEY, todas as API keys dos tenants
# criptografadas no banco ficam INACESSÍVEIS.
```

> ⚠️ **Esta é a chave mestra.** Sem ela, restauração de qualquer backup do banco
> é impossível. Guarde em pelo menos 2 lugares offline.

---

# Parte 4: Configurar DNS e TLS

> O `install_vps.sh` já configurou o certbot. Esta parte é só para casos
> onde você pulou o `--domain` ou quer customizar.

## 4.1. Apontar DNS para o VPS

No painel do seu provedor de DNS (Cloudflare, Route53, Registro.br, etc):

```
Tipo   Nome                Valor              TTL
A      app                 IP_DO_VPS          3600
A      *.evo               IP_DO_VPS          3600
```

Aguarde a propagação (1-48h, mas geralmente < 1h).

Verifique:

```bash
dig +short app.seudominio.com        # deve retornar IP_DO_VPS
dig +short acme.evo.seudominio.com  # deve retornar IP_DO_VPS
```

## 4.2. Configurar TLS manualmente (se certbot falhou)

```bash
# Após DNS propagar:
sudo certbot --nginx -d app.seudominio.com
sudo certbot --nginx -d '*.evo.seudominio.com' --dns-cloudflare-credentials /root/.cloudflare.ini
# (Cloudflare-specific. Para outros provedores, siga a doc do certbot-dns-plugin)
```

Renovação automática já vem configurada (cron do certbot).

## 4.3. Validar HTTPS

```bash
curl -vI https://app.seudominio.com 2>&1 | grep -E "HTTP|expire"
# Esperado: HTTP/2 200 + data de expiração do certificado
```

---

# Parte 5: Criar super admin inicial

> O super admin é o **dono da plataforma** — tem acesso a TODOS os tenants
> e pode fazer qualquer coisa. Crie **poucos** (1-2 é o ideal).

## 5.1. Rodar o seed

```bash
cd /opt/evosync/evosync-web
sudo -u evosync npx tsx scripts/seed-admin.ts
```

**Saída esperada:**
```
[seed-admin] ✓ Super admin criado!
  Email:    admin@seudominio.com
  Senha:    <gerada automaticamente>
  IMPORTANTE: anote a senha AGORA. Ela não pode ser recuperada.
```

> A senha é gerada automaticamente e **impressa uma única vez** no terminal.
> Se você perder, vai ter que resetar via SQL.

## 5.2. Fazer primeiro login

1. Acesse `https://app.seudominio.com/admin/login`
2. Faça login com o email e senha acima
3. **Mude a senha imediatamente** (a senha gerada é temporária)
4. Ative 2FA no email de recuperação (em [[Seguranca]])

## 5.3. Validar

Você deve ver o **Dashboard admin** com:
- Sidebar à esquerda (Dashboard, Empresas, Licenças, Convites, Usuários, Auditoria, Configurações)
- Cards de KPI (Tenants, Usuários, Licenças, Convites) — todos em 0 inicialmente
- Tabela de "Tenants recentes" (vazia)
- Tabela de "Atividade recente" (vazia)

---

# Parte 6: Provisionar primeiro tenant/cliente

> Cada cliente B2B que você atender precisa de uma **instância dedicada da
> Evolution API** (1 container por tenant, porta única).
>
> O `installer/onboard-tenant.sh` faz **tudo em 1 comando**:
> cria DB no Postgres compartilhado, sobe container, gera API key,
> configura nginx + TLS.

## 6.1. Coletar dados do cliente

Antes de rodar o script, anote:

```yaml
Nome:        Acme LTDA
Slug:        acme              ← lowercase, sem espaços, sem acentos
Plano:       Pro
Valor:       R$ 199/mês
Contato:     João (11) 99999-0000
Email:       joao@acme.com.br
```

**Convenção de slug:** `a-z`, `0-9`, hífen. Sem espaços, sem acentos. 2-40 chars.

## 6.2. Rodar o script de provisionamento

```bash
cd /opt/evosync
sudo bash installer/onboard-tenant.sh acme
```

**Saída esperada (resumido):**
```
==>[onboard] Validações iniciais
  ✓ Slug 'acme' validado e livre
==>[onboard] Calculando porta livre
  ✓ Porta escolhida: 8081
==>[onboard] Gerando API key
==>[onboard] Criando database no Postgres
  ✓ Database 'evo_acme' criado
==>[onboard] Subindo container Evolution
  ✓ Container 'evo_acme' iniciado
==>[onboard] Validando conexão
  ✓ Evolution respondendo OK em http://localhost:8081/
==>[onboard] Configurando subdomínio + TLS
  ✓ Vhost nginx criado
  ✓ TLS configurado para evo-acme.evo.seudominio.com
  ✓ Mapeamento salvo em /root/evo-keys.txt

===============================================================
  ✅ Tenant 'acme' provisionado com sucesso!
===============================================================

  URL:        https://evo-acme.evo.seudominio.com
  API Key:    a1b2c3d4e5f6g7h8i9j0...
  Porta:      8081
  Database:   evo_acme
  Container:  evo_acme
  Mapeamento: /root/evo-keys.txt

  Próximos passos:
  1. Criar tenant no admin EvoSync (POST /api/admin/tenants)
  2. Emitir invite em /admin/invites
  3. Mandar pro cliente:
     URL:  https://app.seudominio.com (link do invite)
     API:  a1b2c3d4e5f6g7h8i9j0...
     Evolution URL:  https://evo-acme.evo.seudominio.com
```

**Copie a URL + API Key** — você vai mandar pro cliente.

> As chaves também ficam em `/root/evo-keys.txt` (chmod 600). Não commite.

## 6.3. Criar o tenant no admin EvoSync (via UI)

1. Acesse `https://app.seudominio.com/admin/tenants`
2. Clique em "**Nova empresa**"
3. Preencha:
   - **Nome:** Acme LTDA
   - **Slug:** acme (mesmo slug do script)
4. Clique "Criar tenant"
5. Sistema cria automaticamente uma licença de 30 dias

> O nome e slug devem bater com o que você usou no script (acme).

## 6.4. Emitir invite pro cliente

1. Ainda em `/admin/tenants`, clique no tenant "Acme LTDA"
2. Vá em `/admin/invites`
3. Clique "**Novo convite**"
4. Preencha:
   - **Tenant:** Acme LTDA
   - **Email:** joao@acme.com.br (email do cliente)
   - **Função:** Owner (acesso total ao tenant)
   - **Expira em:** 7 dias
5. Clique "Gerar convite"
6. **Copie o link do convite** gerado (formato: `https://app.../invite/<token>`)

## 6.5. Mandar mensagem pro cliente (WhatsApp/e-mail)

Use este template (substitua os placeholders):

```
Olá João! 👋

Seu EvoSync está pronto. Segue os dados de acesso:

🔗 Link para criar sua senha: <LINK_INVITE>
🌐 URL do sistema: https://app.seudominio.com
📱 URL da sua Evolution API: https://evo-acme.evo.seudominio.com
🔑 Sua chave da Evolution API: a1b2c3d4e5f6...

⚠️ Guarde a chave em local seguro. Ela dá acesso ao seu WhatsApp.

📖 Como começar (passo a passo, 10 min):
https://seudominio.com/guia-cliente (ou anexe o PDF)

Qualquer dúvida, me chama aqui!
```

---

# Parte 7: Configurar o cliente (operator)

> O cliente recebe o convite, cria a senha, e configura a Evolution API.
> Esse é o lado "operator" do app (não confundir com admin).

## 7.1. Cliente aceita o convite

1. Cliente clica no link do convite
2. Vê tela "Definir senha" → cria senha forte
3. É redirecionado pro login → faz login
4. Cai na aba **Conexão** (ou redirecionado pro `/conexao`)

## 7.2. Configurar a Evolution API

Na aba **Conexão** (primeira tela visível), o cliente preenche:

| Campo | Valor |
|---|---|
| **URL da Evolution** | `https://evo-acme.evo.seudominio.com` (que você mandou) |
| **API Key** | `a1b2c3d4...` (que você mandou) |

Clica em "**Testar Conexão**". Esperado: ✅ "Conectado".

> Se der erro, ver [[Runbook-Suporte-Diagnostico]] → "WhatsApp caiu".

## 7.3. Conectar WhatsApp

Após "Testar Conexão" OK, aparece um **QR Code** na tela. O cliente:

1. Abre WhatsApp no celular
2. Vai em **Configurações → Aparelhos conectados → Conectar um aparelho**
3. Aponta a câmera pro QR Code na tela
4. Espera alguns segundos → status muda para "**Conectado**" / "**open**"

## 7.4. Importar primeiros contatos

1. Vai pra aba **Contatos**
2. Clica "**Importar CSV**"
3. Seleciona um arquivo `.csv` no formato:
   ```csv
   numero,nome,empresa
   5511999990001,João Silva,Acme
   5511999990002,Maria Souza,Acme
   ```
4. Espera o toast de sucesso (ex: "3 adicionados")
5. Verifica que os contatos aparecem na tabela

> **Importante:** A primeira coluna DEVE ser `numero` (com DDI, ex: `55...`).
> Colunas extras viram placeholders `{nome}`, `{empresa}` na mensagem.

## 7.5. Criar primeira mensagem

1. Aba **Mensagem**
2. Escreve algo como:
   ```
   Oi {nome}! Tudo bem?

   Estamos com uma promoção na {empresa}.
   Quer saber mais? É só responder essa mensagem.
   ```
3. Clica "**Pré-visualizar**" (com um contato selecionado) — vê como vai ficar
4. Clica "**Salvar**" (rascunho)

## 7.6. Primeiro disparo

1. Volta pra aba **Contatos**
2. Marca 2-3 contatos (checkbox) — **comece pequeno pra testar**
3. Aba **Disparo**:
   - **Delay mínimo:** 30 segundos
   - **Delay máximo:** 60 segundos
   - **Limite diário:** 50 (no primeiro dia)
4. Clica "**Iniciar**"
5. Acompanhe o progresso na tela (atualiza em tempo real via WebSocket)

**Se as mensagens chegarem no WhatsApp dos destinatários, a configuração está completa! 🎉**

## 7.7. Warm-up (regra de ouro)

Avise o cliente: **WhatsApp pune quem dispara muito de uma vez.** A regra:

| Semana | Limite diário sugerido |
|---|---|
| 1ª | 30-50 mensagens/dia |
| 2ª | 50-100/dia |
| 3ª | 100-200/dia |
| 4ª em diante | 200+/dia |

> Mais detalhes em [[Seguranca]] → "Proteção anti-ban".

---

# Parte 8: Manutenção básica

## 8.1. Comandos úteis do dia-a-dia

```bash
# Ver status do serviço
sudo systemctl status evosync

# Ver logs em tempo real
sudo journalctl -u evosync -f

# Reiniciar o serviço
sudo systemctl restart evosync

# Parar
sudo systemctl stop evosync

# Ver uso de disco (importante: SQLite + backups)
df -h
du -sh /opt/evosync/* /var/backups/evosync/

# Health check rápido
curl -s https://app.seudominio.com/api/health
```

## 8.2. Backups

### Automático (já configurado pelo installer)
- **Diário** via cron em `/var/backups/evosync/`
- Retenção: 7 dias (configurável em `/etc/cron.daily/evosync-backup`)

### Manual (para download local)
Veja [[Runbook-Backup-Banco]] — usa o botão "Backup" no admin.

### Validar backup

```bash
# Listar backups
ls -lh /var/backups/evosync/

# Testar integridade
sqlite3 /var/backups/evosync/evosync-2026-06-15-0300.db "PRAGMA integrity_check;"
# Esperado: "ok"
```

## 8.3. Atualizar EvoSync pra nova versão

```bash
cd /opt/evosync
sudo bash installer/install_vps.sh --update
```

**O que faz:**
1. `git pull --ff-only`
2. `npm ci --omit=dev`
3. `next build`
4. `systemctl restart evosync`

**Duração:** ~2-3 minutos, com ~30s de downtime.

## 8.4. Atualizar apenas o app (sem mexer no SO)

```bash
cd /opt/evosync
git pull
cd evosync-web
npm ci --omit=dev
npx next build
sudo systemctl restart evosync
```

## 8.5. Renovação de licença

Quando a licença do tenant expira (mensal), você renova via admin:

1. `/admin/licenses`
2. Filtra "expirando em <30d"
3. Clica "Renovar" → escolhe 30/90/365 dias
4. Sistema estende a licença

Mais detalhes em [[Runbook-Cobranca-Licenca]].

---

# Parte 9: Troubleshooting

## 9.1. "Não consigo fazer login"

```bash
# Verifica logs
sudo journalctl -u evosync -n 50 --no-pager

# Se aparecer "auth.login.failed", pode ser:
# - Senha errada → resetar via seed-admin (cria novo super admin)
# - DB corrompido → ver [[Runbook-Suporte-Diagnostico]]
```

## 9.2. "Cliente reporta: WhatsApp desconectou"

1. Pede pro cliente ir em **Conexão** → verificar status
2. Se "close" ou "open" mas desconectado, pedir pra **re-escanear QR**
3. Se persistir, é problema do celular do cliente (WhatsApp desinstalado, celular trocado)

Mais em [[Runbook-Suporte-Diagnostico]] → "Sintoma 3: WhatsApp caiu".

## 9.3. "Container Evolution caiu"

```bash
ssh root@app.seudominio.com
docker ps -a --filter "name=evo_"
# Ver status de cada container
docker logs --tail 50 evo_acme

# Se travado, reiniciar:
docker restart evo_acme
```

## 9.4. "Disco cheio"

```bash
df -h
du -sh /opt/evosync/* /var/backups/evosync/ /var/log/

# Limpar backups antigos (>30 dias):
sudo find /var/backups/evosync -mtime +30 -delete

# Limpar logs antigos:
sudo journalctl --vacuum-time=7d
```

## 9.5. "Certbot falhou (DNS não propagado)"

```bash
# Verificar DNS
dig +short evo-acme.evo.seudominio.com
# Deve retornar IP_DO_VPS

# Se propagou, rodar certbot manualmente:
sudo certbot --nginx -d evo-acme.evo.seudominio.com
```

## 9.6. "ENCRYPTION_KEY perdida"

**Cenário ruim.** Sem a chave mestra, todas as API keys dos tenants
criptografadas no banco ficam ilegíveis. Os clientes podem logar, mas
não conseguem conectar à Evolution API.

**Prevenção:** SEMPRE salve o `.env` em local seguro (1Password, Bitwarden, etc)
imediatamente após a instalação.

**Recuperação (parcial):** Se você tem um backup do banco **antes** da perda,
o restore para o estado anterior à perda da chave.

---

# Apêndice

## A. Variáveis de ambiente (`.env`)

| Var | Default | Descrição |
|---|---|---|
| `DATABASE_URL` | `./data/evosync.db` | Caminho do SQLite |
| `PORT` | `3000` | Porta do app Next.js |
| `NODE_ENV` | `production` | Sempre production em prod |
| `LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `ENCRYPTION_KEY` | *(gerado)* | 64 chars hex. **NUNCA rotacionar** sem migração |
| `AUTH_SECRET` | *(gerado)* | 32+ bytes base64 (NextAuth) |
| `EVO_URL` | (vazio) | URL da Evolution do **primeiro tenant** (legacy) |
| `EVO_APIKEY` | (vazio) | API key do primeiro tenant (legacy) |
| `EVO_INSTANCE` | (vazio) | Instance name (legacy) |

> `EVO_*` são por-tenant (campo `evoApiKeyEncrypted` na tabela `tenants`).
> As vars do `.env` são apenas fallback / primeiro tenant.

## B. Estrutura de arquivos do servidor

```
/opt/evosync/                              ← código-fonte
├── evosync-web/                           ← app Next.js
│   ├── data/evosync.db                    ← SQLite (NÃO deletar)
│   ├── data/backups/                      ← backups do reset/restore
│   ├── .env                               ← chaves secretas (chmod 600)
│   └── .next/                             ← build artifacts
├── infra/evolution/                       ← compose base (postgres+redis+evol)
├── installer/                              ← scripts de setup
│   ├── install_vps.sh
│   ├── install_linux.sh                   ← local desktop (dev)
│   ├── install_web_linux.sh               ← local web (dev)
│   ├── onboard-tenant.sh                  ← provisionar 1 tenant
│   ├── uninstall_vps.sh
│   └── ...
├── main.py                                ← desktop legado
└── ...

/etc/systemd/system/evosync.service       ← unit systemd (criado pelo installer)
/etc/cron.daily/evosync-backup            ← backup diário (criado pelo installer)
/etc/nginx/sites-available/evo-*          ← vhosts nginx (criados por tenant)
/var/backups/evosync/                     ← backups automáticos (SQLite)
/home/<user>/evo-keys.txt                 ← mapeamento tenant→key (manual)
```

## C. Comandos úteis one-liners

```bash
# Ver quantos tenants provisionados
docker ps --filter "name=evo_" --format "{{.Names}}" | wc -l

# Ver uso de memória do app
ps aux | grep -E "tsx|next" | grep -v grep | awk '{sum+=$4} END {print "RSS total:", sum/1024, "MB"}'

# Ver últimas 100 linhas de log + grep por erro
sudo journalctl -u evosync --since "1 hour ago" | grep -iE "error|fail|warn"

# Encontrar tenant pela porta
docker ps --format "{{.Names}}\t{{.Ports}}" | grep "0.0.0.0:808"

# Testar API de um tenant específico
curl -s https://evo-acme.evo.seudominio.com/ -H "apikey: $(grep acme /root/evo-keys.txt | awk '{print $3}')"
```

## D. Próximos passos (backlog de features)

Não fazem parte do setup, mas podem ser úteis:

- **Stripo Stripe** para cobrança automática ([[Runbook-Cobranca-Licenca]] é manual hoje)
- **CI/CD no GitHub Actions** para deploy automático em cada push na main
- **Monitoramento** (Uptime Kuma, Grafana, ou similar)
- **Backup offsite** (S3, B2) — `/var/backups/evosync` está só local
- **Multi-region** (mover Evolution para latência menor)
- **Webhooks** (notificar Slack/Discord em eventos importantes)

## E. Custos estimados

| Item | Custo/mês (USD) |
|---|---|
| VPS 2GB (Hetzner) | ~$5 |
| Domínio (Registro.br) | ~$1/mês |
| Backups offsite (B2) | <$1 |
| **Total** | **~$7/mês** |
| Por tenant (se 10) | ~$0.70/mês |

Sem custo por mensagem (Evolution self-hosted). Lucro saudável.

## F. Links do vault (para aprofundar)

| Doc | O que tem |
|---|---|
| [[MOC-Raiz]] | Entrada do vault, navegação geral |
| [[Design-System-v2]] | UI/UX do admin (v2) |
| [[Runbook-Onboarding-Tenant-Script]] | Detalhes do `onboard-tenant.sh` |
| [[Runbook-Backup-Banco]] | Backup manual via admin |
| [[Runbook-Restaurar-Banco]] | Restaurar banco a partir de .db |
| [[Runbook-Reset-Banco]] | Zerar banco (zona de perigo) |
| [[Runbook-Cobranca-Licenca]] | Ciclo de mensalidade |
| [[Runbook-Suporte-Diagnostico]] | Troubleshooting de produção |
| [[Deploy-VPS]] | Guia original (que este doc expande e atualiza) |
| [[Seguranca]] | Modelo de segurança + criptografia |
| [[ADR-004-Modelo-SaaS-Hospedado]] | Por que você hospeda tudo |
| [[Visao-Geral]] | Arquitetura do software |
| [[06-QA/Relatorio-Testes-2026-06-15]] | Status dos testes E2E |

---

## Changelog deste guia

| Data | Mudança |
|---|---|
| 2026-06-15 | Criação inicial (versão consolidada de install_vps.sh + runbooks dispersos) |

> **Próxima atualização sugerida:** após o primeiro deploy real (adicionar
> screenshots, edge cases encontrados, etc).
