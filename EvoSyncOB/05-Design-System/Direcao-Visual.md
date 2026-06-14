---
tipo: design-system
tags: [evosync, design-system, direcao-visual, referencias]
criado: 2026-06-14
status: ativo
---

# Direção Visual — por que Linear + Vercel

> Documento de referência. Quando alguém perguntar "por que esse design?",
> aponte pra cá.

## Resumo em uma frase

Mistura de **Linear** (densidade, tipografia forte, hierarquia) com
**Vercel Dashboard** (glass, dark mode profissional, microanimações) —
com a **identidade EvoSync** (verde primário) por cima.

## Referências (as boas)

### Linear (linear.app)
- ✅ **Tipografia forte:** Inter display, pesos 500/600/700, tracking tight
- ✅ **Hierarquia por elevação:** cards com 5 níveis de sombra
- ✅ **Sparklines sutis** em KPI cards
- ✅ **Estados vazios** com ilustração + CTA
- ✅ **Tabular numerals** em dados
- ✅ **Comando ⌘K** com navegação
- ✅ **Focus rings** sutis (não berrantes)

### Vercel Dashboard (vercel.com/dashboard)
- ✅ **Dark mode default** mas com **light alternation**
- ✅ **Glass topbar** com backdrop-blur
- ✅ **Brand mark** (logo monocromático em gradient)
- ✅ **Subtle dot/grid patterns** no background
- ✅ **Color tokens via CSS variables** (HSL)
- ✅ **Theme toggle** com 3 opções (light/dark/system)
- ✅ **Microanimações spring** (cubic-bezier 0.16, 1, 0.3, 1)

### Stripe Dashboard (dashboard.stripe.com)
- ✅ **Stat cards** com ícones em badges coloridas
- ✅ **Filtros pill** (segmented control) com contadores
- ✅ **Action confirmations** com diálogos elegantes
- ✅ **Empty states** com ilustrações SVG inline

### Resend (resend.com)
- ✅ **Logo "3 nós conectados"** (inspiração para o brand mark)
- ✅ **Estilo de cor de acento única** + neutros
- ✅ **Contraste alto** sem ser agressivo

## Anti-referências (o que NÃO fazer)

### Material Design (puro)
- ❌ **Ripa de design genérico** — não tem personalidade
- ❌ **Ripples** em cliques (antiquado, 2016)
- ❌ **Elevation por shadow grande** (no Linear, elevation é sutil)

### Bootstrap
- ❌ **Tabelas cinza** (`table-striped`, `table-hover` em cinza)
- ❌ **Botões primary blue** genéricos (`#0d6efd`)
- ❌ **Form controls** quadrados e sem personalidade

### Ant Design (puro)
- ❌ **Densidade muito alta** com tons de cinza
- ❌ **Muito "enterprise"** — não é o que o cliente B2B leigo quer ver
- ❌ **Confuso** para usuários não-técnicos

### Tailwind UI genérico
- ❌ **slate-50 + slate-900** sem identidade
- ❌ **Gradientes aleatórios** (`from-indigo-500 to-purple-600`)
- ❌ **Ícones sem propósito** (decorativos em vez de funcionais)

## Decisões concretas (e por que)

### "Por que dark default?"

| Contexto | Decisão |
|---|---|
| App do operador já é dark | Coerência |
| Dark "parece mais premium" (percepção) | Tendência de SaaS modernos |
| Cliente vai abrir o admin raramente | Cada impressão deve ser "wow" |
| Suporta bem dados densos | Audit log, tabelas |

Oferecemos **light alternation** via `ThemeToggle` no topbar (respeitando `prefers-color-scheme` por padrão).

### "Por que verde primário?"

Verde já é a cor do app desktop Python e do app do operador.
**Não trocar o que já é identidade.** Botão WhatsApp é verde. Significa "OK, sucesso, envio".

### "Por que Inter + Space Grotesk?"

- **Inter:** 99% dos SaaS modernos usam. Boa legibilidade em UI densa.
- **Space Grotesk:** tem personalidade, levemente geométrico. Combina com a vibe "tech/profissional" do EvoSync. Usamos só em títulos e números grandes (não no corpo).
- **JetBrains Mono:** para IDs, slugs, tokens de convite, action names. Importante para audit log ficar legível.

### "Por que glass no topbar?"

Glass (backdrop-blur + bg com alpha) é um sinal visual de "este elemento está acima de tudo". Quando o usuário rola uma tabela, o topbar continua visível e legível sem ser uma barreira opaca.

### "Por que sparklines nos stat cards?"

Mostram **tendência** sem precisar de um gráfico separado. Em 8-10 pontos, o usuário percebe se o número está subindo, descendo, ou estável. Mais barato cognitivamente que olhar 2 números (atual + anterior).

### "Por que HSL e não HEX?"

| HEX | HSL |
|---|---|
| `#1f9d65` (cor) | `hsl(158 64% 36%)` |
| Opaco fixo | Permite `hsl(var(--primary) / 0.5)` para alpha |
| Difícil de manipular | Fácil de derivar variantes (hover, subtle) |
| Sem estrutura semântica | Hue saturation lightness = estrutura |

`Tailwind.config.ts` lê as variáveis com `hsl(var(--primary) / <alpha-value>)`.

### "Por que não usar shadcn/ui puro?"

shadcn/ui é excelente como base, mas:
- Cores default são slate (sem identidade)
- Componentes são funcionais, não opinionated
- Ajustar para cada projeto é esperado

Nós **usamos** shadcn/ui (Dialog, Dropdown, Select, etc.) mas:
- Sobrescrevemos o tema em `globals.css`
- Adicionamos componentes novos com opinião (StatCard, StatusBadge, etc.)

## Onde estamos vs. onde queremos chegar

| Aspecto | Antes (v1) | Agora (v2) | Onde queremos (v3) |
|---|---|---|---|
| Tema | Inconsistente (3 cores) | Dark default + light toggle | Dark/light/auto com transições suaves |
| Tipografia | Inter only | Inter + Space Grotesk + Mono | Variável fonts com optical sizing |
| Tokens | Hardcoded (slate/indigo) | HSL variables + Tailwind | Design tokens exportados (Style Dictionary) |
| Componentes | shadcn genérico | Custom opinionated | Storybook público |
| Gráficos | Nenhum | Recharts (preparado) | Dashboard analytics real |
| Acessibilidade | Básica | Radix + focus rings | Audit WCAG AA |
| Animações | Tailwind animate | Animações custom + spring | Framer Motion em microinterações |

## Onde mostrar essa direção

| Onde | Como |
|---|---|
| Onboarding do cliente | Print do dashboard no [[Guia-Cliente-Primeiros-Passos]] (em breve) |
| Para novos devs | "Olha [[Design-System-v2]] antes de codar" |
| Para stakeholders | "Seguimos o padrão de Linear/Vercel/Stripe" |

## Links relacionados

- [[Design-System-v2]]
- [[Design-Tokens]]
- [[Componentes]]
- [[MOC-Raiz]]
