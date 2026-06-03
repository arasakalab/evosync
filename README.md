# EvoTeste — Disparador em massa (Evolution API v2)

GUI em Python (CustomTkinter) para enviar mensagens em massa via [Evolution API](https://doc.evolution-api.com).

## Instalacao automatizada

O modo recomendado e hibrido: a Evolution API roda em Docker com PostgreSQL e Redis, enquanto a interface do DisparoFacil roda localmente em Python.

### Linux

```bash
cd ~/Desktop/EvoTeste
bash installer/install_linux.sh
```

Depois da primeira instalacao, abra com:

```bash
bash installer/start_linux.sh
```

### Windows

No PowerShell:

```powershell
cd caminho\para\EvoTeste
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\installer\install_windows.ps1
```

Depois da primeira instalacao, abra com duplo clique em `installer\start_windows.bat` ou `run_windows.bat`.

### O que o instalador faz

- verifica Docker e Docker Compose, mas nao instala Docker automaticamente;
- cria `.venv` e instala `requirements.txt`;
- cria `.env` do app se ele ainda nao existir;
- cria `infra/evolution/.env` se ele ainda nao existir;
- sobe `evolution-api`, `postgres` e `redis` com Docker Compose;
- abre o app local com `python main.py`.

Se o Docker nao estiver instalado, instale primeiro:

- Linux: https://docs.docker.com/get-docker/
- Windows: https://docs.docker.com/desktop/setup/install/windows-install/

Para parar somente a stack Docker:

```bash
bash installer/stop_stack.sh
```

No Windows:

```bat
installer\stop_stack.bat
```

## Como rodar manualmente

### Linux

```bash
cd ~/Desktop/EvoTeste
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

### Windows

```bat
cd caminho\para\EvoTeste
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Na primeira execução use a aba **Conexão** para preencher URL, API Key e nome da instância. A chave é gravada em `.env` com permissão `600` quando o sistema permite.

Se você usa modelos pelo OpenCode, preencha **Modelo OpenCode** com `provider/model` na aba **Conexão**. Se deixar vazio, o app usa o modelo vision testado `nvidia/meta/llama-3.2-90b-vision-instruct`.

O instalador gera a chave `AUTHENTICATION_API_KEY` em `infra/evolution/.env`. Copie esse valor para `EVO_APIKEY` no `.env` do app ou preencha pela aba **Conexão**.

## Fluxo

1. **Conexão** — teste ping + status da instância (`connectionState`).
2. **Contatos** — importe um CSV (coluna obrigatória: `numero`) ou adicione manualmente. Campos extras (ex: `nome`, `empresa`) podem ser usados como placeholders na mensagem.
3. **Mensagem** — escreva o texto usando `{nome}`, `{empresa}` etc. Anexe 1 mídia opcional (imagem/vídeo/PDF). Use **Pré-visualizar**.
4. **Disparo** — configure delay mínimo/máximo e limite diário. Clique em **Iniciar**. Pode pausar/retomar/parar a qualquer hora.

## IA para criar mensagem

Na aba **Mensagem**, selecione uma imagem ou PDF promocional e clique em **OpenCode IA**. O app envia a mídia para `opencode run --file`, usando o modelo configurado em **Modelo OpenCode** ou `nvidia/meta/llama-3.2-90b-vision-instruct` quando o campo estiver vazio.

A IA extrai campanha, loja, produtos, preços, unidades e validade quando estiverem claros, e preenche o campo de mensagem com um texto editável para WhatsApp. Ela não dispara mensagens sozinha. Sempre revise o texto gerado antes de iniciar o disparo.

## Proteções anti-ban (já embutidas)

- Delay aleatório entre envios (configurável).
- **Warm-up**: primeiros 50 envios usam delay 2× maior.
- Auto-pausa em caso de erro 401/403 (sinal de ban ou auth).
- Persistência em `sent_log.json` — se o app fechar ou parar, os números já enviados **não são reenviados** ao retomar.
- Verifica o status da instância a cada envio; se cair, para tudo.
- Limite diário (default 200) para reduzir risco.

## Arquivos gerados

- `.env` — credenciais (chmod 600)
- `config.json` — preferências de UI (delays, última mensagem)
- `sent_log.json` — números já enviados (não reenviar)
- `send_run.log` — log textual de cada execução

## Gerar executável

O caminho recomendado é usar PyInstaller separadamente em cada sistema.

```bash
pip install -r requirements.txt
pip install -r requirements-build.txt
pyinstaller --onefile --windowed --name EvoTeste main.py
```

No Linux, gere o executável em uma máquina Linux. No Windows, gere em uma máquina Windows. Mantenha `.env`, `config.json`, `sent_log.json` e `send_run.log` junto do executável quando quiser preservar configurações e histórico.

## Dicas

- **Comece com poucos números** (10–20) pra calibrar o tom da mensagem e ver se o WhatsApp não reclama.
- **Não envie mensagens idênticas em massa** — o WhatsApp detecta spam. Personalize com `{nome}` e variações.
- **Aqueça a conta**: nos primeiros dias, limite-se a ~30–50 mensagens/dia e vá aumentando.
- **Não use números fixos comerciais novos** pra esse tipo de envio — risco alto de ban imediato.

## CSV de exemplo

```csv
numero,nome,empresa
5511999990001,João Silva,Acme LTDA
5511999990002,Maria Souza,Globex
```

A primeira linha (cabeçalho) é obrigatória. O nome das colunas extras vira placeholder (`{nome}`, `{empresa}`).
