---
tipo: doc
tags: [evosync, negocios, produto, readme]
criado: 2026-06-14
status: ativo
origem: README.md + CHANGELOG.md (raiz)
---

# EvoSync — README do Projeto

> Mescla do `README.md` raiz (instalação e uso do app desktop) com o `CHANGELOG.md`
> raiz (índice de versões). Para detalhes técnicos, siga os links.

## O que é

GUI em Python (CustomTkinter) para enviar mensagens em massa via [Evolution API v2](https://doc.evolution-api.com).
O repositório contém **dois apps** que coexistem:

| App | Onde | Tipo | Última versão |
|---|---|---|---|
| **Desktop legado** | raiz (`main.py` + módulos) | Python + CustomTkinter, mono-operador, JSON files | estável (sem versionamento) |
| **SaaS Web** | `evosync-web/` | Next.js 14 multi-tenant + SQLite + Drizzle | **1.1.0** (Contatos Organizados) |

Detalhamento técnico: [[Visao-Geral]] (web) e [[MOC-App-Desktop]] (desktop).

## Instalação automatizada (desktop)

### Linux

```bash
cd ~/Desktop/EvoSync
bash installer/install_linux.sh
```

Depois da primeira instalação:

```bash
bash installer/start_linux.sh
```

### Windows

```powershell
cd caminho\para\EvoSync
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installer\install_windows.ps1
```

Depois: duplo clique em `installer\start_windows.bat` ou `run_windows.bat`.

### O que o instalador faz

- verifica Docker e Docker Compose (não instala Docker automaticamente);
- cria `.venv` e instala `requirements.txt`;
- cria `.env` do app se não existir;
- cria `infra/evolution/.env` se não existir;
- sobe `evolution-api`, `postgres` e `redis` com Docker Compose;
- abre o app local com `python main.py`.

Se Docker não estiver instalado:
- Linux: https://docs.docker.com/get-docker/
- Windows: https://docs.docker.com/desktop/setup/windows-install/

Para parar somente a stack Docker:
```bash
bash installer/stop_stack.sh
# Windows:
installer\stop_stack.bat
```

## Como rodar manualmente (desktop)

### Linux
```bash
cd ~/Desktop/EvoSync
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

### Windows
```bat
cd caminho\para\EvoSync
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Na primeira execução use a aba **Conexão** para preencher URL, API Key e nome da instância. A chave é gravada em `.env` com permissão `600`.

Para OpenCode, preencha **Modelo OpenCode** com `provider/model` na aba Conexão. Se deixar vazio, usa o modelo vision testado `nvidia/meta/llama-3.2-90b-vision-instruct`.

## Fluxo de uso (desktop)

1. **Conexão** — teste ping + status da instância (`connectionState`).
2. **Contatos** — importe CSV (coluna obrigatória `numero`) ou adicione manualmente. Colunas extras viram placeholders (`{nome}`, `{empresa}`).
3. **Mensagem** — texto com placeholders + 1 mídia opcional (imagem/vídeo/PDF). Use **Pré-visualizar**.
4. **Disparo** — delay mínimo/máximo + limite diário. Iniciar/Pausar/Retomar/Parar.
5. **Agenda** — agendamento único (DD/MM/AAAA HH:MM) com mídia opcional.

## Mensagens agendadas

- **Congelar contatos atuais** — snapshot da lista no momento do save.
- **Usar contatos da tela no horário** — usa a lista aberta quando chega o horário.
- Persistência em `scheduled_messages.json`.
- Se o app estiver fechado → marca como `missed`, **não envia atrasado**.

## Histórico de envios

- `sent_log.json` registra números já enviados.
- Aba **Disparo** → **Reenviar números já no histórico** permite nova campanha para os mesmos números.

## IA para criar mensagem

- Aba **Mensagem** → selecione imagem/PDF → **OpenCode IA**.
- Envia a mídia para `opencode run --file`, usando o modelo configurado ou o default.
- Extrai campanha, loja, produtos, preços, unidades, validade. Texto editável.
- **Não dispara sozinha.** Sempre revise.

## Proteções anti-ban (embutidas)

- Delay aleatório entre envios
- **Warm-up**: primeiros 50 envios com delay 2× maior
- Auto-pausa em 401/403
- Persistência em `sent_log.json` — não reenvia ao retomar
- Verifica status da instância a cada envio
- Limite diário (default 200)

## Arquivos gerados (desktop)

- `.env` — credenciais (chmod 600)
- `config.json` — preferências de UI
- `persisted_contacts.json` — contatos carregados
- `scheduled_messages.json` — agendamentos
- `sent_log.json` — números já enviados
- `send_run.log` — log textual

## Gerar executável

```bash
pip install -r requirements.txt
pip install -r requirements-build.txt
pyinstaller --onefile --windowed --name EvoSync main.py
```

No Linux, gere em uma máquina Linux. No Windows, gere em Windows. Mantenha
`.env`, `config.json`, `sent_log.json` e `send_run.log` junto do executável.

## Dicas

- Comece com **10–20 números** pra calibrar o tom
- **Não envie mensagens idênticas** — personalize com `{nome}` e variações
- **Aqueça a conta**: 30–50 mensagens/dia nos primeiros dias
- **Não use números fixos comerciais novos** — risco alto de ban

## CSV de exemplo

```csv
numero,nome,empresa
5511999990001,João Silva,Acme LTDA
5511999990002,Maria Souza,Globex
```

A primeira linha (cabeçalho) é obrigatória. O nome das colunas extras vira
placeholder (`{nome}`, `{empresa}`).

## Versões (changelog raiz)

| App | Changelog detalhado | Última versão |
|---|---|---|
| `evosync-web/` (Next.js, SaaS) | `evosync-web/docs/CHANGELOG.md` | **1.1.0** (Contatos Organizados) |
| `main.py` (Python desktop, legado) | sem changelog (versão única estável) | — |

### Última mudança notável — 2026-06-14 — v1.1.0 (web)

ADR-001 implementado em `evosync-web/`: a tela de Contatos agora separa
**catálogo** de **seleção de envio**, com tags, listas nomeadas, opt-out
(LGPD/anti-ban) e seleção persistente na nuvem.

**Resumo em uma frase:** o usuário pode importar 500 contatos, marcar
80 com checkbox, criar uma lista "Campanha X" com esses 80, agendar um
disparo às 18h, e a Evolution API só vai receber os 80 — mesmo que o
usuário edite a seleção depois.

Detalhes técnicos em `evosync-web/docs/contacts-organization.md` (espelhado em [[Modulo-Contatos-Web]]).

## Links relacionados

- [[MOC-Raiz]] — índice do vault
- [[MOC-App-Desktop]] — mapa do app Python
- [[MOC-SaaS-Web]] — mapa do app web
- [[ADR-001-Contatos-Organizados]] — a v1.1.0 em formato ADR
- [[ADR-004-Modelo-SaaS-Hospedado]] — modelo de negócio (SaaS hospedado)
- [[Deploy-VPS]] — deploy do web em produção
- [[Seguranca]] — modelo de ameaças
- [[Guia-Cliente-Primeiros-Passos]] — manual do cliente B2B (linguagem leiga)
- [[Runbook-Onboarding-Cliente]] — como provisionar um cliente novo
