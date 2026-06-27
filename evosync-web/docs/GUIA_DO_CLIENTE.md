# EvoSync — Guia do Cliente (Versão Web)

> Manual de uso pensado para o **cliente final** que vai operar o EvoSync pelo navegador.
> Linguagem simples, sem termos técnicos desnecessários. Passo a passo do login ao primeiro disparo.

---

## 1. O que é o EvoSync?

O EvoSync é uma ferramenta web para você **enviar mensagens em massa pelo WhatsApp** de forma organizada e segura.

Com ele você pode:

- Importar uma lista grande de contatos (planilha ou do próprio WhatsApp).
- Escrever uma mensagem personalizada com o nome de cada pessoa.
- Anexar uma imagem, vídeo ou PDF.
- Disparar aos poucos, com pausas automáticas, para o WhatsApp não bloquear seu número.
- Agendar campanhas para disparar automaticamente no dia e hora que você escolher.

Tudo isso pelo navegador, sem instalar nada no computador.

---

## 2. Como acessar

### 2.1 Primeiro acesso — você recebeu um convite

1. Abra o e-mail que o administrador do EvoSync enviou.
2. Clique no link de convite (ele tem este formato: `https://seu-evosync.com/invite/...`).
3. Na tela que abrir, **crie uma senha** para a sua conta.
4. Pronto! Você já está logado.

### 2.2 Acessos seguintes

1. Acesse o endereço do EvoSync (fornecido pelo administrador).
2. Digite seu **e-mail** e **senha**.
3. Clique em **Entrar**.

> Dica: se você esqueceu a senha, entre em contato com o administrador do sistema. Por segurança, a redefinição é feita por ele.

---

## 3. Tour pela interface

Quando você entra, vê uma tela dividida em:

```
┌─────────────────────────────────────────────────┐
│  [Logo]  EvoSync                  [Seu nome] [Sair] │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Conexão  │                                      │
│ Contatos │        CONTEÚDO DA PÁGINA            │
│ Mensagem │                                      │
│ Disparo  │                                      │
│ Agenda   │                                      │
│          │                                      │
├──────────┴──────────────────────────────────────┤
│  Status · Relógio                              │
└─────────────────────────────────────────────────┘
```

- **Menu lateral (esquerda):** as 5 áreas principais do sistema.
- **Topo:** seu nome, botão de sair e indicador de tema (claro/escuro).
- **Rodapé:** mostra o que está acontecendo agora no sistema.

A ordem recomendada de uso é: **Conexão → Contatos → Mensagem → Disparo → Agenda**.

---

## 4. Conexão (configure 1 vez só)

**Objetivo:** ligar o EvoSync ao seu WhatsApp.

1. No menu lateral, clique em **Conexão**.
2. Preencha os 3 campos que o administrador do EvoSync te passou:
   - **URL da Evolution** — endereço do servidor.
   - **API Key** — uma senha longa (clique no olhinho 👁 para ver/ocultar).
   - **Nome da instância** — identifica a sua conexão.
3. Clique em **Testar conexão** para confirmar que está tudo certo.
   - Se aparecer ✅ verde, está conectado.
   - Se aparecer ❌ vermelho, revise os dados ou peça ajuda ao administrador.
4. Clique em **Salvar**.

Pronto! Você só precisa mexer aqui de novo se trocar de servidor ou de número.

> Dica extra: o campo **Modelo OpenCode** é opcional e serve para gerar mensagens automaticamente a partir de uma imagem. Pode deixar em branco se não for usar.

---

## 5. Contatos (sua lista de pessoas)

**Objetivo:** montar a lista de quem vai receber as mensagens.

### 5.1 Formas de adicionar contatos

Na parte de cima da tela, você tem 3 botões:

| Botão | Para que serve |
|---|---|
| **Importar CSV** | Subir uma planilha com número, nome, etc. |
| **Importar WhatsApp** | Puxar contatos direto da sua agenda do WhatsApp. |
| **Adicionar** | Colocar 1 contato por vez, manualmente. |

#### Importar CSV (planilha)

1. Clique em **Importar CSV**.
2. Escolha o arquivo `.csv` no seu computador.
3. O sistema vai mostrar quantos contatos foram adicionados, atualizados ou estavam repetidos.

**Como deve ser a planilha:**

A primeira linha é o cabeçalho. A coluna **numero** é obrigatória (com DDD e país: `5511999990001`). As outras colunas são opcionais e viram "campos extras" que você pode usar na mensagem.

Exemplo de planilha (`clientes.csv`):

| numero | nome | empresa | cidade |
|---|---|---|---|
| 5511999990001 | João Silva | Acme LTDA | São Paulo |
| 5511999990002 | Maria Souza | Globex | Rio de Janeiro |

> Dica: você pode baixar um modelo de CSV pelo botão **Baixar exemplo** (se disponível) ou abrir o Excel/Google Sheets, salvar como CSV e importar.

#### Importar do WhatsApp

1. Clique em **Importar WhatsApp**.
2. Aguarde alguns segundos.
3. O sistema traz os contatos da agenda do WhatsApp conectado.

### 5.2 Organizar contatos

Sua lista fica salva na nuvem. Para facilitar, você pode:

- **Buscar** — use a barra de pesquisa para achar alguém por nome, número ou qualquer campo.
- **Filtrar por modo** (botões no catálogo):
  - **Todos** — mostra todo o catálogo.
  - **Opt-out** — só quem pediu para não receber mensagens (LGPD).
- **Painel "Para envio"** — mostra quantos contatos estão marcados para a próxima campanha. Use **Ver selecionados** para filtrar só os marcados.
- **Filtrar por tag** — agrupar por etiquetas como "vip", "lead-quente" etc.
- **Filtrar por lista** — criar listas nomeadas, tipo "Black Friday" ou "São Paulo".

### 5.3 Selecionar quem vai receber a próxima campanha

Existem **dois conceitos importantes** que separemos para você:

- **Catálogo** = todos os contatos que você já importou (fica salvo para sempre).
- **Seleção** = o subconjunto que vai para a próxima campanha.

Para selecionar:

1. Clique na linha do contato (ou marque o quadradinho ☐ no início da linha).
2. A linha fica destacada. O painel **Para envio** e o badge no topo mostram quantos estão marcados.
3. Use **Selecionar visíveis** para marcar todos que aparecem na tela (opt-out não pode ser marcado).

**Fluxo recomendado:** importar → marcar em Contatos → ir para Disparo. Desmarcados **nunca** recebem, independente da aba ativa.

> A seleção fica salva na nuvem. Você pode fechar o navegador e voltar depois que ela continua lá.

### 5.4 Marcar alguém como "opt-out" (não enviar)

Se alguém pediu para não receber mais mensagens:

1. Marque o(s) contato(s) na tabela.
2. Use a barra de ação que aparece: **Opt-out** → **Marcar opt-out**.

A partir daí, **o EvoSync nunca mais envia mensagem para essa pessoa**, mesmo se ela estiver na lista de envio. Isso é uma proteção legal (LGPD).

Para liberar de novo, é só marcar e clicar em **Liberar opt-out**.

### 5.5 Remover contatos

- **Remover 1 ou mais:** marque na tabela → clique em **Remover** na barra de ação.
- **Apagar a lista inteira:** use o botão **Limpar tudo** (cuidado: não tem volta).

### 5.6 Criar lista ou tag em massa

Com vários contatos selecionados, use a barra de ação para:

- **Criar lista** — agrupa os selecionados numa lista nomeada (ex: "VIP", "Black Friday").
- **Adicionar tag** — coloca uma etiqueta nos selecionados (ex: "lead-quente").

---

## 6. Mensagem (o que vai ser enviado)

**Objetivo:** escrever o texto e, se quiser, anexar uma imagem/vídeo/PDF.

### 6.1 Escrever o texto

Na caixa grande de texto, escreva sua mensagem. Para personalizar com o nome de cada pessoa, use **placeholders** com `{}`:

Exemplo:
```
Olá {nome}! 👋
Tudo bem? Vimos que você é da {empresa}.
Temos uma oferta especial para você em {cidade}.
```

No lugar de `{nome}`, o sistema coloca automaticamente o nome de cada contato da planilha (ou da agenda). Se o contato não tiver nome, o trecho fica em branco — sem quebrar a mensagem.

> Dica: quanto mais personalizada a mensagem, menor a chance de o WhatsApp reclamar. Evite mensagens 100% iguais para todo mundo.

### 6.2 Anexar uma mídia (opcional)

1. Em **Mídia opcional**, clique em **Escolher arquivo**.
2. Selecione uma imagem, vídeo ou PDF do seu computador.
3. Escolha o **Tipo** (image, video ou document).
4. Aparece o nome do arquivo ao lado — pronto, está anexado.

### 6.3 Pré-visualizar

Antes de disparar, clique em **Pré-visualizar**. O sistema mostra como a mensagem vai ficar para o primeiro contato da sua seleção. Confira se os placeholders estão sendo substituídos corretamente.

### 6.4 Gerar texto com IA (opcional)

Se você tem uma imagem ou PDF de promoção e quer que a IA escreva a mensagem:

1. Faça upload da mídia (passo 6.2).
2. Clique em **OpenCode IA**.
3. Em alguns segundos, a IA preenche a caixa de texto com uma sugestão.
4. **Sempre revise** o texto antes de disparar. A IA não envia nada sozinha.

---

## 7. Disparo (enviar a campanha)

**Objetivo:** mandar as mensagens com segurança, no seu ritmo.

### 7.1 Antes de iniciar

1. Volte em **Contatos** e confirme que você tem alguém selecionado (ou todo o catálogo, se preferir enviar para todos).
2. Vá em **Mensagem** e confirme que o texto está pronto.
3. Clique em **Disparo** no menu lateral.

### 7.2 Parâmetros do envio

| Campo | O que faz | Recomendação |
|---|---|---|
| **Delay mínimo (s)** | Tempo mínimo de espera entre uma mensagem e outra | 8s |
| **Delay máximo (s)** | Tempo máximo de espera | 15s |
| **Limite diário** | Quantas mensagens no máximo por dia | 200 |
| **Validar números antes** | Confere se o número tem WhatsApp antes de mandar | **Ativar** |
| **Reenviar números já no histórico** | Permite reenviar para quem já recebeu | Desligado |

> O sistema já tem proteções embutidas:
> - Os **primeiros 50 envios** usam delay 2× maior (aquecimento da conta).
> - Se o WhatsApp der erro de autenticação (401/403), o envio **pausa sozinho** (sinal de possível bloqueio).
> - Se a conexão cair, o envio para automaticamente.

### 7.3 Iniciar

1. Clique em **Iniciar**.
2. A barra de progresso vai enchendo. Você acompanha em tempo real:
   - **Enviados** ✅
   - **Falharam** ❌
   - **Pendentes** ⏳
   - **Pulados (histórico)** — quem já recebeu
   - **Sem WhatsApp** — número que não existe ou não tem WhatsApp
   - **Opt-out** — quem pediu para não receber
3. No **Log** embaixo, cada evento é registrado com horário.

### 7.4 Pausar, retomar, parar

- **Pausar** — congela o envio. Os números já enviados continuam no histórico.
- **Retomar** — continua de onde parou.
- **Parar** — encerra de vez. O que já foi enviado **fica no histórico** (não envia de novo na próxima campanha).

> Você pode fechar o navegador com o envio pausado e voltar depois — o estado fica salvo no servidor.

### 7.5 Resetar histórico

Se quiser **reenviar para os mesmos números** numa próxima campanha, use o botão **Resetar histórico**. O sistema pede confirmação, porque é uma ação que não tem volta.

> Dica: para reenviar para a mesma lista sem perder o controle, deixe a opção **Reenviar números já no histórico** ligada na próxima campanha. Assim você não precisa resetar.

---

## 8. Agenda (programar para depois)

**Objetivo:** deixar uma campanha pronta para disparar automaticamente em uma data e hora específicas.

1. No menu lateral, clique em **Agenda**.
2. Preencha:
   - **Data** (DD/MM/AAAA) e **Hora** (HH:MM) — precisa ser no futuro.
   - **Contatos**:
     - **Congelar contatos atuais** — salva uma cópia da sua lista agora (use se vai mexer na lista depois).
     - **Usar seleção atual no horário** — usa quem estiver marcado na hora marcada.
   - **Mensagem agendada** — escreva o texto (ou clique em **Copiar mensagem atual** para usar a da aba Mensagem).
   - **Mídia (opcional)** — caminho do arquivo, se houver.
3. Clique em **Agendar**.

O agendamento aparece na tabela embaixo com o status **pendente**.

### 8.1 Status dos agendamentos

| Status | Significado |
|---|---|
| Pendente | Esperando a data/hora chegar. |
| Em execução | Disparando agora. |
| Concluído | Já foi enviado. |
| Falhou | Deu erro na execução (veja a mensagem). |
| Cancelado | Foi excluído por você. |

### 8.2 Editar ou excluir

- **Editar** (ícone de lápis) — só funciona com agendamentos pendentes. Carrega os dados no formulário para você ajustar.
- **Excluir selecionados** — marque 1 ou mais e clique no botão.
- **Excluir todas** — apaga toda a agenda (não afeta o histórico de envios).

> Atenção: o agendamento **só dispara se o servidor do EvoSync estiver rodando** no horário marcado. Se o servidor estiver fora do ar, o agendamento é marcado como perdido e não é reenviado em atraso.

---

## 9. Dicas de uso e boas práticas

### Para evitar bloqueio do WhatsApp

- **Comece pequeno.** Nas primeiras campanhas, teste com 10 a 20 contatos.
- **Aqueça a conta.** Nos primeiros dias, limite-se a 30 a 50 mensagens por dia. Vá aumentando aos poucos.
- **Personalize.** Mensagens 100% iguais em massa são detectadas como spam. Use `{nome}`, `{empresa}` e variações.
- **Não use números comerciais novos.** Linhas recém-contratadas têm risco alto de ban imediato.
- **Respeite o opt-out.** Quem pediu para sair não recebe mais, ponto.

### Para organizar melhor

- Use **tags** e **listas** em vez de ficar importando CSV toda hora.
- Crie listas por objetivo: "Black Friday", "Reativação", "VIP", "SP Capital" etc.
- Filtre por lista antes de iniciar um disparo — assim você não manda para quem não deve.

### Para não perder trabalho

- O catálogo, a seleção e os agendamentos ficam **salvos na nuvem** automaticamente.
- Se você fechar o navegador, o envio em andamento **pausa** (não cancela). É só voltar e dar **Retomar**.
- Mensagens enviadas ficam no **histórico** e não são reenviadas, mesmo se você fechar tudo.

---

## 10. Problemas comuns

| Problema | O que fazer |
|---|---|
| **Não consigo entrar** | Confira e-mail e senha. Se esqueceu, peça ao administrador para redefinir. |
| **Conexão em vermelho** | Revise URL, API Key e nome da instância. Clique em **Testar conexão** de novo. |
| **Disparou pouco e travou** | Provavelmente o WhatsApp limitou. Aguarde algumas horas, reduza o limite diário e tente de novo. |
| **Número entrou como inválido** | Confirme se está no formato com DDD + 55: `5511999990001`. |
| **Não recebo os envios em tempo real no log** | Atualize a página (F5). O WebSocket às vezes cai em redes instáveis. |
| **Agendamento não disparou** | Verifique se o servidor do EvoSync estava no ar no horário. Se não estava, o agendamento é perdido. |

---

## 11. Resumo rápido (passo a passo da primeira campanha)

1. **Login** → entre com e-mail e senha.
2. **Conexão** → preencha URL, API Key, instância. Teste. Salve.
3. **Contatos** → importe um CSV (ou do WhatsApp) ou adicione manualmente.
4. **Contatos** → marque quem vai receber (clique nas linhas).
5. **Mensagem** → escreva o texto usando `{nome}`, `{empresa}` etc. Anexe uma mídia se quiser. Pré-visualize.
6. **Disparo** → confirme os parâmetros. Clique em **Iniciar**. Acompanhe pela barra de progresso.
7. (Opcional) **Agenda** → programe para outro dia/hora se preferir.

Pronto. Em 7 passos você fez a primeira campanha 🎉

---

## 12. Suporte

Se travar em alguma etapa, anote:

- O que você estava fazendo.
- A mensagem de erro que apareceu (ou o que aconteceu).
- Um print da tela (se possível).

E envie para o administrador do seu EvoSync. Ele tem acesso aos logs do servidor e consegue te ajudar mais rápido.

---

*EvoSync Web v1.1.0 — por Arasaka Lab.*
