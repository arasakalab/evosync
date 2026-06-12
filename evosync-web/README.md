# EvoSync Web — Disparador em massa (Next.js 14)

Esta é a **versão web** do EvoSync, com a mesma lógica de negócio do app Python legado (`../main.py`) reescrita em TypeScript e empacotada numa UI Next.js 14 com shadcn/ui.

A **funcionalidade é idêntica**: 5 abas (Conexão, Contatos, Mensagem, Disparo, Agenda), mesmo comportamento de delays, validação prévia, persistência, agendamento, OpenCode IA, e anti-ban.

A **persistência** continua em arquivos (`config.json`, `persisted_contacts.json`, `scheduled_messages.json`, `sent_log.json`), então a configuração é compatível com a versão desktop.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **shadcn/ui + Tailwind CSS** (paleta dark/verde idêntica à versão desktop)
- **WebSocket** nativo (`ws`) em `/ws` para atualizações em tempo real do envio
- **runner assíncrono no mesmo processo** (substitui worker_threads para evitar problemas com tsx loader)
- **fetch** nativo para a Evolution API (substituindo `requests`)

## Requisitos

- Node.js 18+ (recomendado 20+)
- A Evolution API rodando (use o instalador do projeto, ou um servidor próprio)
- (Opcional) `opencode` no PATH para a aba Mensagem → OpenCode IA

## Instalação automatizada (recomendada)

Linux:

```bash
cd /caminho/para/EvoSync-mod2
bash installer/install_web_linux.sh
bash installer/start_web_linux.sh
```

Windows (PowerShell):

```powershell
cd caminho\para\EvoSync-mod2
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installer\install_web_windows.ps1
installer\start_web_windows.bat
```

O instalador:

1. Sobe a stack Docker (Evolution + Postgres + Redis)
2. Cria `.env` com `EVO_URL`, `EVO_APIKEY`, `EVO_INSTANCE` (mesmo arquivo do app Python)
3. Instala dependências npm
4. Gera o build de produção
5. Imprime a URL `http://localhost:3000`

## Instalação manual

```bash
cd evosync-web
npm install
cp .env.example .env   # preencha EVO_URL / EVO_APIKEY / EVO_INSTANCE
npm run build
NODE_ENV=production npm run start
```

Em desenvolvimento:

```bash
cd evosync-web
npm install
npm run dev
```

Acesse `http://localhost:3000`. O servidor expõe:

- `GET /` → redireciona para `/conexao`
- `GET /api/*` → API REST
- `WS /ws` → atualizações em tempo real

## Endpoints REST principais

| Método | Rota | Descrição |
|---|---|---|
| `GET/PUT` | `/api/settings` | Carrega/salva `config.json` + `.env` |
| `POST` | `/api/connection/test` | Testa ping + connectionState |
| `GET/POST/DELETE` | `/api/contacts` | Lista/adiciona/remove contatos |
| `POST` | `/api/contacts/import-csv` | Importa CSV parseado |
| `POST` | `/api/contacts/import-whatsapp` | Importa via `/chat/findContacts` |
| `POST` | `/api/contacts/clear` | Limpa todos |
| `POST` | `/api/message/preview` | Renderiza template para o 1º contato |
| `GET` | `/api/send/status` | Status atual do worker |
| `POST` | `/api/send/start` | Inicia disparo |
| `POST` | `/api/send/pause` / `resume` / `stop` | Controles |
| `POST` | `/api/send/reset-history` | Apaga `sent_log.json` |
| `GET/POST/DELETE` | `/api/schedules` | CRUD de agendamentos |
| `PUT/DELETE` | `/api/schedules/:id` | Atualiza/exclui um agendamento |
| `POST` | `/api/schedules/all` | Exclui todos (DELETE) |
| `POST` | `/api/opencode/generate` | Upload multipart, retorna texto |
| `POST` | `/api/upload/media` | Upload de mídia |

## WebSocket (`ws://localhost:3000/ws`)

Eventos `server → client`:

```ts
{ type: "status", payload: SendStatus }
{ type: "log",    payload: { ts, line, level } }
{ type: "progress", payload: { percent, current, total } }
{ type: "done",   payload: { summary, counts } }
{ type: "conn",   payload: { ok, state, msg } }
{ type: "schedule_update", payload: { id, status, error } }
{ type: "hello",  payload: { ts } }
```

## Estrutura de pastas

```
evosync-web/
├── server.ts                  # Next + WS + scheduler
├── package.json
├── tailwind.config.ts
├── next.config.mjs
├── server/                    # lógica port do Python
│   ├── paths.ts
│   ├── evo/client.ts          # EvoClient (fetch)
│   ├── sender/                # runner assíncrono
│   ├── opencode/client.ts     # spawn do CLI opencode
│   ├── store/                 # settings, contacts, schedules, sent-log
│   ├── scheduler/loop.ts      # 30s check
│   └── ws/hub.ts              # broadcast
├── app/                       # páginas + API routes
│   ├── layout.tsx
│   ├── globals.css
│   ├── conexao/page.tsx
│   ├── contatos/page.tsx
│   ├── mensagem/page.tsx
│   ├── disparo/page.tsx
│   ├── agenda/page.tsx
│   └── api/
├── components/                # shadcn/ui + layout + features
│   ├── layout/{app-shell,sidebar,header,status-bar}.tsx
│   ├── ui/                    # primitives (button, dialog, etc)
│   └── status-badge.tsx
├── hooks/use-websocket.ts
├── lib/{api,store,phone,types,utils}.ts
└── data/                      # .env, config.json, persisted_contacts.json, ...
```

## Compatibilidade com a versão desktop

Os arquivos de persistência ficam em `data/` (`config.json`, `persisted_contacts.json`, `scheduled_messages.json`, `sent_log.json`) e `.env`. Os formatos são os mesmos do app Python — você pode inclusive copiar os arquivos entre as duas versões.

> A versão web lê o `.env` do diretório raiz do projeto (mesmo do app Python), então as credenciais configuradas em `Conexão → Salvar` aparecem no arquivo `.env` com permissão 600.

## Próximos passos

- Suporte a PWA (instalar como app)
- Dark/light theme switch
- Multi-instância (várias Evolution simultâneas)
- Versão SaaS multi-tenant
