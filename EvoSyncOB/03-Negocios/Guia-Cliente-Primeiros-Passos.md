---
tipo: doc
tags: [evosync, guia, cliente, primeiros-passos, leigo]
criado: 2026-06-14
status: ativo
publico-alvo: cliente-b2b
tempo-estimado: 10-15min
---

# Bem-vindo ao EvoSync! 🚀

> **Para quem é este guia:** você acabou de contratar o EvoSync e recebeu
> um link de convite por e-mail/WhatsApp. Este documento te leva do zero
> até a primeira mensagem enviada, em **~10 minutos**, sem precisar saber
> nada de tecnologia.

> **Se travar em algum passo:** me chama no WhatsApp (número no final).

---

## O que você recebeu

Da nossa conversa, você deve ter em mãos:

| Item | Exemplo |
|---|---|
| **Link de convite** | `https://app.evosync.com.br/invite/abc123...` |
| **Endereço do sistema** | `https://app.evosync.com.br` |
| **Endereço da sua Evolution API** | `https://evo-suaempresa.evosync.com.br` |
| **Chave da Evolution API** | uma string longa tipo `a1b2c3d4e5...` |

> **Importante:** a chave da Evolution é como uma senha do seu WhatsApp.
> Não compartilhe com ninguém.

---

## Passo 1 — Criar sua senha

1. Abra o **link de convite** no navegador (Chrome, Firefox, Edge).
2. Você verá uma tela pedindo para **definir uma senha**.
3. Escolha uma senha forte (mínimo 8 caracteres, misture letras e números).
4. Clique em **"Criar conta"**.

> **Não conseguiu?** O link expira em 7 dias. Se expirou, me chama que gero outro.

---

## Passo 2 — Entrar no sistema

1. Acesse o **endereço do sistema** (ex: `https://app.evosync.com.br`).
2. Faça login com:
   - **E-mail:** o mesmo que você me passou
   - **Senha:** a que você acabou de criar
3. Você verá a tela principal do EvoSync, com abas no lado esquerdo.

---

## Passo 3 — Conectar seu WhatsApp

> **Essa é a parte mais importante.** Aqui o sistema vai se conectar ao
> seu número de WhatsApp.

1. No menu lateral, clique em **"Conexão"**.
2. Você vai ver 2 campos para preencher:
   - **URL da Evolution API:** cole o `Endereço da sua Evolution API` que você recebeu
   - **API Key:** cole a `Chave da Evolution API`
3. Clique em **"Testar Conexão"**.
   - Se aparecer ✅ "Conectado", pode prosseguir.
   - Se aparecer ❌ erro, me chama no WhatsApp (não é problema seu, é rápido de resolver).
4. Em seguida, na mesma tela, vai aparecer um **QR Code**.
5. **No seu celular:**
   - Abra o WhatsApp
   - Vá em **Configurações → Aparelhos conectados → Conectar um aparelho**
   - Aponte a câmera do celular para o QR Code da tela
6. Aguarde alguns segundos. O status vai mudar para **"Conectado"** ou **"Open"**.

> **Pronto!** Seu WhatsApp está integrado ao EvoSync. A partir de agora,
> o sistema pode enviar mensagens pelo seu número.

> ⚠️ **Atenção:** use um número que não seja comercial novo. WhatsApp pode
> bloquear contas novas que disparam muitas mensagens de uma vez.

---

## Passo 4 — Importar seus contatos

> **Dica:** se você não tem contatos ainda, pode pular este passo e voltar depois.

1. No menu lateral, clique em **"Contatos"**.
2. Clique em **"Importar CSV"** (canto superior direito).
3. Selecione um arquivo `.csv` do seu computador.

### Formato do arquivo

O arquivo precisa ter pelo menos uma coluna chamada `numero`. Exemplo:

```csv
numero,nome,empresa
5511999990001,João Silva,Acme LTDA
5511999990002,Maria Souza,Globex
```

- A primeira linha é o **cabeçalho** (obrigatório).
- A coluna `numero` é **obrigatória** (com DDI, ex: `55` para Brasil).
- Colunas extras viram **placeholders** que você pode usar na mensagem
  (ex: `{nome}`, `{empresa}`).

> **Não tem o arquivo pronto?** Posso te enviar um modelo (.xlsx) — me chama.

4. Aguarde o upload. Você verá a lista de contatos aparecer na tela.

---

## Passo 5 — Criar sua primeira mensagem

1. No menu lateral, clique em **"Mensagem"**.
2. No campo de texto, escreva sua mensagem. Exemplo:

   ```
   Oi {nome}! Tudo bem?

   Estamos com uma promoção especial na {empresa} esta semana.
   Quer saber mais? É só responder essa mensagem!
   ```

   > **Repare no `{nome}` e `{empresa}`** — esses são os placeholders.
   > O sistema substitui automaticamente pelo nome/empresa de cada contato.
   > Isso deixa a mensagem **pessoal**, e o WhatsApp não considera spam.

3. (Opcional) Clique em **"Pré-visualizar"** para ver como fica a mensagem
   com dados reais de um contato.
4. (Opcional) Em **"Mídia"**, você pode anexar 1 imagem, vídeo ou PDF.

---

## Passo 6 — Fazer um disparo de teste

> **IMPORTANTE:** faça seu primeiro disparo com **poucos contatos** (5-10)
> pra testar. Só depois dispare para a lista toda.

1. No menu lateral, clique em **"Disparo"**.
2. Em **"Contatos"**, marque **somente 5 a 10 contatos** de teste (pode
   ser o seu próprio número pra testar).
3. Confirme:
   - **Delay mínimo:** sugestão 30 segundos
   - **Delay máximo:** sugestão 60 segundos
   - **Limite diário:** sugestão 50
4. Clique em **"Iniciar"**.
5. Acompanhe o progresso na tela. Cada envio mostra ✅ (sucesso) ou ❌ (erro).

> **Se der erro 401/403:** o WhatsApp pode ter sinalizado sua conta.
> **Pare o disparo imediatamente** e me chama.

---

## Dicas importantes

### ⏱️ Comece devagar
- **1ª semana:** máximo 30 mensagens/dia
- **2ª semana:** até 50/dia
- **3ª semana em diante:** pode aumentar gradualmente
- WhatsApp pune quem dispara muito de uma vez.

### ✍️ Personalize sempre
- **Nunca** envie a mesma mensagem idêntica para 500 pessoas.
- Use `{nome}`, `{empresa}` e varie o texto.
- Mensagens personalizadas chegam e são lidas. Mensagens genéricas são ignoradas/bloqueadas.

### 🚫 Respeite quem pedir pra sair
- Se alguém responder "para de me mandar mensagem" ou "sair":
  - Vá em **Contatos** → encontre a pessoa → marque como **"Opt-out"**
  - O sistema **nunca mais** envia pra essa pessoa.

### 📊 Acompanhe os números
- Aba **"Disparo"** mostra em tempo real: quantas enviadas, quantas com erro, quantas puladas.
- Não ignore erros: se a taxa de erro passar de 5%, pare e me chama.

---

## Resumo: o que cada aba faz

| Aba | O que faz |
|---|---|
| **Conexão** | Conecta seu WhatsApp (QR Code) |
| **Contatos** | Sua lista de clientes (catálogo + seleção de envio) |
| **Mensagem** | Onde você escreve o texto e anexa mídia |
| **Disparo** | Onde você inicia, pausa ou para o envio |
| **Agenda** | Agendar disparo para data/hora futura |

---

## Precisa de ajuda?

- **WhatsApp do suporte:** (XX) XXXXX-XXXX _(você recebe no convite)_
- **E-mail:** suporte@seudominio.com.br
- **Horário:** seg-sex, 9h-18h

> Para problemas urgentes (WhatsApp caiu, disparo travou), me chama
> **sempre no WhatsApp** — é mais rápido.

---

## Links internos (referência técnica)

> Estes links são para o time da Arasaka Lab, não pro cliente final.
> Se você (cliente) chegou aqui, pode ignorar.

- [[ADR-004-Modelo-SaaS-Hospedado]] — como o serviço é entregue
- [[Runbook-Onboarding-Cliente]] — o que fizemos para liberar seu acesso
- [[Runbook-Suporte-Diagnostico]] — playbook de suporte
- [[README-Projeto]] — visão geral do produto
