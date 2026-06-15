---
tipo: runbook
tags: [evosync, runbook, onboarding, tenant, script, bash, interno, saas]
criado: 2026-06-14
status: ativo
publico-alvo: interno
---

# Runbook — Script `onboard-tenant.sh`

> **Quem usa:** você (SaaS provider / super_admin).
> **Quando:** cada vez que chega um cliente B2B novo.
> **Onde:** direto no VPS onde o EvoSync está rodando.
> **Objetivo:** provisionar 1 instância Evolution API dedicada em **1 comando**, sem ter que digitar docker run, psql, nginx toda vez.

## TL;DR

```bash
ssh root@app.evosync.com.br
bash /opt/evosync/installer/onboard-tenant.sh acme
# (copiar URL + API Key do output, mandar pro cliente)
```

Tempo: **~30 segundos** (mais ~5 min se for criar subdomínio + TLS, esperando certbot).

## Pré-requisitos no VPS

O VPS já precisa ter (1× só, configurado pelo `install_vps.sh`):

- Docker rodando
- Container Postgres `disparofacil_postgres` no ar (porta default 5432)
- Container Redis `disparofacil_redis` no ar
- Network Docker `evolution-shared` (criada automaticamente)
- nginx + certbot instalados (só se quiser subdomínio)
- DNS wildcard: `*.evosync.com.br` → IP do VPS

> Se algum desses faltar, o script aborta com mensagem clara apontando o que falta.

## O que o script faz (passo a passo)

```
1. Valida slug (formato + disponibilidade)
2. Verifica Docker, Postgres, network
3. Encontra próxima porta livre (8081, 8082, 8083...)
4. Gera AUTHENTICATION_API_KEY (openssl rand -hex 24)
5. Cria database 'evo_<slug>' no Postgres compartilhado
6. Sobe container 'evo_<slug>' com:
   - porta única no host
   - volume dedicado (evo_<slug>_instances)
   - conexão ao Postgres compartilhado
   - conexão ao Redis compartilhado
   - prefix_key único por tenant (no Redis)
7. Aguarda 15s e testa conexão (curl + apikey)
8. (Opcional) Cria vhost nginx + TLS via certbot
9. Salva mapeamento slug → key em ~/evo-keys.txt (chmod 600)
10. Imprime resumo: URL + API Key + próximos passos
```

## Como usar

### Caso comum (com subdomínio + TLS)

```bash
bash installer/onboard-tenant.sh acme
```

Cria `https://evo-acme.evosync.com.br` com TLS válido.

### Sem subdomínio (acesso direto por porta)

```bash
bash installer/onboard-tenant.sh padaria-do-ze --no-domain
```

Cliente acessa via `http://IP-DO-VPS:8081`. Útil para testes ou clientes que vão colocar atrás de proxy próprio.

### Porta customizada (se 8081-8199 estiver ocupado)

```bash
EVOLUTION_PORT_BASE=9000 bash installer/onboard-tenant.sh imob-sp
```

### Domínio customizado

```bash
DOMAIN_BASE=meudominio.io bash installer/onboard-tenant.sh cliente
# Cria https://evo-cliente.meudominio.io
```

### Não salvar em `evo-keys.txt`

```bash
bash installer/onboard-tenant.sh tenant-teste --no-log
```

## Saída (exemplo)

```
==>[onboard] Validações iniciais
  ✓ Slug 'acme' validado e livre

==>[onboard] Calculando porta livre
  ✓ Porta escolhida: 8081

==>[onboard] Gerando API key
  ✓ API key gerada (24 bytes hex = 48 chars)

==>[onboard] Criando database no Postgres
  ✓ Database 'evo_acme' criado

==>[onboard] Subindo container Evolution
  ✓ Container 'evo_acme' iniciado

==>[onboard] Validando conexão
  ✓ Evolution respondendo OK em http://localhost:8081/

==>[onboard] Configurando subdomínio + TLS
  ==> Configurando vhost nginx para evo-acme.evosync.com.br...
  ✓ Vhost nginx criado
  ==> Obtendo certificado TLS via certbot...
  ✓ TLS configurado para evo-acme.evosync.com.br

  ✓ Mapeamento salvo em /root/evo-keys.txt

===============================================================
  ✅ Tenant 'acme' provisionado com sucesso!
===============================================================

  URL:        https://evo-acme.evosync.com.br
  API Key:    a1b2c3d4e5f6...
  Porta:      8081
  Database:   evo_acme
  Container:  evo_acme
  Mapeamento: /root/evo-keys.txt

  Próximos passos:
  1. Criar tenant no admin EvoSync (POST /api/admin/tenants)
  2. Emitir invite em /admin/invites
  3. Mandar pro cliente...

===============================================================
```

## Próximos passos depois de rodar

1. **Criar o tenant no SQLite do EvoSync**:
   - Via UI: `/admin/tenants` → "Nova empresa" → nome + slug
   - Via API: `POST /api/admin/tenants` com `{ name, slug, licenseDays }`
2. **Emitir o invite**:
   - Via UI: `/admin/invites` → "Novo convite" → email do cliente
   - Via API: `POST /api/admin/invites` com `{ tenantId, email, role: "owner" }`
3. **Mandar mensagem pro cliente** com:
   - Link do invite
   - URL do app: `https://app.seusite.com.br`
   - URL da Evolution: (a que apareceu no output do script)
   - API Key: (a que apareceu no output)

Mensagem template em [[Runbook-Onboarding-Cliente]] (passo F).

## Variáveis de ambiente (customização)

| Variável | Default | Para que serve |
|---|---|---|
| `EVOLUTION_PORT_BASE` | `8081` | Porta inicial. Próxima livre é calculada a partir daqui. |
| `MAX_PORT` | `8199` | Última porta possível (anti-port-scan). |
| `POSTGRES_CONTAINER` | `disparofacil_postgres` | Nome do container do Postgres. |
| `POSTGRES_USER` | `evolution` | User do Postgres. |
| `EVOLUTION_NETWORK` | `evolution-shared` | Network Docker compartilhada. |
| `EVOLUTION_IMAGE` | `evoapicloud/evolution-api:latest` | Imagem da Evolution. |
| `DOMAIN_BASE` | `evosync.com.br` | Domínio base para subdomínios. |
| `EVOLUTION_DOMAIN_PREFIX` | `evo` | Prefixo do subdomínio. |
| `EMAIL_ADMIN` | `admin@<DOMAIN_BASE>` | Email p/ certbot. |
| `KEYS_LOG` | `~/evo-keys.txt` | Onde salvar mapeamento slug→key. |
| `SERVER_IP` | (vazio) | IP do VPS p/ fallback se não usar subdomínio. |
| `NGINX_SITES_AVAILABLE` | `/etc/nginx/sites-available` | Path padrão nginx. |
| `NGINX_SITES_ENABLED` | `/etc/nginx/sites-enabled` | Path padrão nginx. |

## Idempotência e segurança

| Cenário | Comportamento |
|---|---|
| Container `evo_<slug>` já existe | **ABORTA** (não sobrescreve) |
| Database `evo_<slug>` já existe | **ABORTA** (não sobrescreve) |
| Porta já em uso no host | Pula pra próxima |
| Slug fora do padrão `[a-z0-9-]{2,40}` | ABORTA com mensagem |
| Docker não responde | ABORTA com mensagem |
| Postgres não está rodando | ABORTA apontando o container esperado |
| Network Docker não existe | ABORTA com comando para criar |
| certbot falha (DNS não propagado) | **Continua** + warn, mas o script termina OK (vhost criado, TLS pendente) |

> **Nada é destrutivo.** O script só cria coisas novas. Para remover, use
> [[Runbook-Reset-Banco]] → "Como deletar (churn confirmado)" + `docker rm`.

## Troubleshooting

### "Não consegui descobrir a senha do Postgres"

O script tenta, em ordem:
1. `printenv POSTGRES_PASSWORD` dentro do container
2. `/opt/evosync/infra/evolution/.env`
3. `./infra/evolution/.env` (relativo ao cwd)
4. `/opt/evosync/evosync-web/.env`
5. `./evosync-web/.env`

Se nenhum desses existir com `POSTGRES_PASSWORD=...`, falha. Solução:
```bash
# Adicione a senha num dos arquivos esperados
echo 'POSTGRES_PASSWORD=sua-senha' >> /opt/evosync/infra/evolution/.env
```

### "Não encontrei porta livre entre 8081 e 8199"

Você tem 119 tenants. Hora de **migrar para a Opção C** (UI com Docker SDK)
ou reescalar a VPS. Veja o runbook principal.

### "certbot falhou (DNS não propagado)"

O script continua e imprime OK. O nginx vhost já foi criado. Rode depois:
```bash
certbot --nginx -d evo-acme.evosync.com.br
```

### "Porta 8081 colidiu com outro container que não é meu"

O script faz `docker port` para listar portas já usadas, então isso não deveria acontecer. Se aconteceu, é bug — reporte com:
```bash
docker ps -a --format "table {{.Names}}\t{{.Ports}}"
```

## Onde fica o mapeamento

`~/evo-keys.txt` (por default, chmod 600):

```
==========================================
Data:    2026-06-14T15:30:00-03:00
Slug:    acme
Porta:   8081
Domain:  evo-acme.evosync.com.br
API Key: a1b2c3d4e5f6...
DB:      evo_acme
Container: evo_acme

==========================================
Data:    2026-06-14T16:45:00-03:00
Slug:    padaria-do-ze
...
```

> **Segurança:** este arquivo contém chaves de API em texto plano. Permissão
> 600, em `~root/`, não commitar. Se precisar compartilhar com dev, criptografe.

## Limpeza (churn / erro)

Para remover um tenant provisionado pelo script:

```bash
# Para e remove container
docker stop evo_<slug> && docker rm evo_<slug>

# Remove volume
docker volume rm evo_<slug>_instances

# Dropa database
docker exec -it disparofacil_postgres psql -U evolution \
  -c "DROP DATABASE evo_<slug>;"

# Remove vhost nginx
sudo rm /etc/nginx/sites-{available,enabled}/evo-<slug>
sudo certbot delete --cert-name evo-<slug>.evosync.com.br
sudo nginx -t && sudo systemctl reload nginx

# Remove a entrada em ~/evo-keys.txt
```

Ou via UI EvoSync (se o tenant já foi criado no SQLite):
- `/admin/tenants` → deletar
- Script acima para limpar Postgres + Docker

## Arquivos

| Arquivo | Função |
|---|---|
| `installer/onboard-tenant.sh` | Script bash (este runbook documenta) |
| `installer/install_vps.sh` | Setup inicial (roda 1× por VPS) |
| `installer/install_linux.sh` | Setup desktop local (referência) |
| `EvoSyncOB/02-Operacao/Runbook-Onboarding-Cliente.md` | Procedimento manual antigo (mantido como fallback) |
| `EvoSyncOB/02-Operacao/Runbook-Reset-Banco.md` | Cleanup (deletar tenant) |
| `~/evo-keys.txt` | Mapeamento slug → key (criado pelo script) |

## Próximas evoluções

- [ ] **`offboard-tenant.sh`** — script companheiro para remoção
- [ ] **Migração para UI** — Opção C do runbook anterior (Docker SDK via admin)
- [ ] **Multi-tenant de Evolution** — uma única instância com N WhatsApps (em vez de N containers)

## Links relacionados

- [[Runbook-Onboarding-Cliente]] — procedimento completo (manual + script)
- [[Runbook-Reset-Banco]] — cleanup de tenant
- [[Runbook-Backup-Banco]] — snapshot do SQLite do EvoSync (não da Evolution)
- [[ADR-004-Modelo-SaaS-Hospedado]] — você hospeda por tenant
- [[Seguranca]] — criptografia das keys no banco
