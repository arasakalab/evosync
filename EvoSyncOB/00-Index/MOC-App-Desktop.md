---
tipo: moc
tags: [evosync, desktop, python, moc]
criado: 2026-06-14
status: ativo
origem: raiz do repo (main.py + módulos)
---

# MOC — App Desktop (Python legado)

> GUI em Python (CustomTkinter) para enviar mensagens em massa via Evolution API.
> Funciona como **app mono-operador local**. O SaaS web é a evolução multi-tenant
> (veja [[MOC-SaaS-Web]] e a decisão [[ADR-003-Stack-Python-Desktop-Legado]]).

## Visão geral

| Item | Valor |
|---|---|
| Linguagem | Python 3 |
| GUI | CustomTkinter |
| HTTP client | `requests` (httpx em alguns pontos) |
| Persistência | JSON files locais + `.env` |
| Concorrência | `threading` no `sender_worker` |
| Entry point | `main.py` (83 KB — módulo único grande) |

## Estrutura de arquivos

```
raiz-do-repo/
├── main.py                 ← entry point + UI (83 KB)
├── evo_client.py           ← wrapper HTTP da Evolution API
├── sender_worker.py        ← loop de envio, anti-ban, warm-up
├── scheduler_store.py      ← persistência de agendamentos
├── contacts_store.py       ← persistência de contatos
├── opencode_client.py      ← integração IA (OpenCode) p/ gerar mensagens
├── config.py               ← leitura de .env e config.json
├── config.json             ← preferências de UI (delays, última msg)
├── persisted_contacts.json ← contatos carregados na tela
├── scheduled_messages.json ← campanhas agendadas
├── sent_log.json           ← números já enviados (não reenviar)
├── send_run.log            ← log textual de cada execução
├── requirements.txt
├── requirements-build.txt
├── run_linux.sh / run_windows.bat
└── installer/              ← scripts de install/start/stop
```

## Mapa de módulos

### `main.py` (83 KB)
- **Responsabilidade:** UI principal (CustomTkinter), eventos de botões, composição das abas.
- **Abas:** Conexão · Contatos · Mensagem · Disparo · Agenda
- **Observação:** arquivo monolítico — candidato natural a refatoração
  (ver [[ADR-003-Stack-Python-Desktop-Legado]]).
- **Referência externa:** [[README-Projeto]]

### `evo_client.py`
- **Responsabilidade:** chamadas HTTP à Evolution API (`/instance/connect`,
  `/message/sendText`, status check).
- **Cuidados:** tratamento de 401/403 → auto-pausa (sinal de ban/auth).

### `sender_worker.py`
- **Responsabilidade:** loop de envio com:
  - Delay aleatório configurável
  - **Warm-up** nos primeiros 50 envios (delay 2× maior)
  - Auto-pausa em 401/403
  - Verificação de status da instância a cada envio
  - Limite diário (default 200)
- **Persistência:** grava em `sent_log.json` — se o app fechar, **não reenvia**
  ao retomar.

### `scheduler_store.py`
- **Responsabilidade:** CRUD de `scheduled_messages.json`.
- **Comportamento:** se o app estiver fechado no horário → marca como `missed`,
  **não envia atrasado**.
- **Modos:** "Congelar contatos atuais" (snapshot) vs "Usar contatos da tela no horário".

### `contacts_store.py`
- **Responsabilidade:** CRUD de `persisted_contacts.json`.
- **Importação:** CSV (coluna obrigatória: `numero`) ou manual.
- **Placeholders:** colunas extras viram `{nome}`, `{empresa}` na mensagem.

### `opencode_client.py`
- **Responsabilidade:** invoca `opencode run --file` para gerar mensagem a partir
  de imagem/PDF promocional (vision).
- **Modelo default:** `nvidia/meta/llama-3.2-90b-vision-instruct`.

### `config.py` + `config.json`
- Lê `.env` (URL, API key, instância) e `config.json` (preferências de UI).

## Proteções anti-ban (já embutidas no `sender_worker`)

- Delay aleatório entre envios
- Warm-up (50 primeiros com delay 2×)
- Auto-pausa em 401/403
- Persistência em `sent_log.json`
- Verificação de status da instância a cada envio
- Limite diário (default 200)

## Fluxo de uso (resumido)

```
1. Conexão    → ping + status da instância
2. Contatos   → import CSV (numero + colunas extras) ou manual
3. Mensagem   → template com {nome}/{empresa} + mídia opcional
4. Disparo    → delay min/max, limite diário, iniciar/pausar/parar
5. Agenda     → agendamento único (DD/MM/AAAA HH:MM)
```

## Como rodar

```bash
# Linux
cd ~/Desktop/EvoSync
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

```bat
:: Windows
cd caminho\para\EvoSync
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## Relação com o SaaS web

- O desktop é **mantido** por compatibilidade com operadores solo.
- A evolução está em [[MOC-SaaS-Web]] (multi-tenant, agendamento persistente,
  admin panel, audit log).
- Decisão de coexistência: [[ADR-003-Stack-Python-Desktop-Legado]].
