---
tipo: design-system
tags: [evosync, design-system, tokens, cores, tipografia, sombras]
criado: 2026-06-14
status: ativo
---

# Design Tokens

> Os "átomos" do design system. Tudo no app é construído a partir desses tokens.
> Defina uma vez, use em qualquer lugar. Mudar aqui = mudar em todo o app.

## Paleta de cores

### Primary (Verde EvoSync)

| Token | Light (HSL) | Dark (HSL) | Uso |
|---|---|---|---|
| `primary` | `158 64% 36%` | `158 70% 48%` | Ações primárias, foco, links |
| `primary-hover` | `158 64% 30%` | `158 70% 55%` | Hover de botões |
| `primary-foreground` | `0 0% 100%` | `168 50% 6%` | Texto dentro de fundo primary |
| `primary-subtle` | `158 60% 94%` | `158 50% 14%` | Backgrounds suaves (badges, chips) |
| `primary-ring` | `158 64% 36%` | `158 70% 50%` | Focus rings |

### Semantic (info / success / warning / danger)

| Token | Uso |
|---|---|
| `info` | Links secundários, badges neutros-positivos, ações informativas |
| `success` | Confirmações, status "active", trend positivo |
| `warning` | Atenção, licenças expirando, status "pending" |
| `danger` | Erros, ban, deleção, trend negativo |

Cada um tem 3 sub-tokens: `DEFAULT`, `subtle` (bg), `foreground` (text).

### Surface (fundos)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `background` | `#f5f9f7` | `#0a1411` | Background do app |
| `surface` | `#ffffff` | `#101c18` | Cards, panels |
| `surface-alt` | `#eff5f2` | `#16241f` | Sidebar, header |
| `surface-raised` | `#ffffff` | `#16241f` | Modals, dropdowns |
| `surface-sunken` | `#e8efe c` | `#0c1513` | Input backgrounds |

### Border / Muted

| Token | Uso |
|---|---|
| `border` | Bordas sutis (cards, inputs) |
| `muted` | Background de chips, áreas desabilitadas |
| `muted-foreground` | Texto secundário, placeholders, ícones inativos |

## Tipografia

### Fontes

| Família | Uso | Origem |
|---|---|---|
| **Inter** (--font-sans) | UI geral, corpo de texto | next/font/google |
| **Space Grotesk** (--font-display) | Títulos, números grandes (StatCards), brand | next/font/google |
| **JetBrains Mono** (--font-mono) | Código, IDs, slugs, tokens | next/font/google |

### Escala (line-height incluído)

| Token | Size | Line | Uso |
|---|---|---|---|
| `text-2xs` | 11px | 16px | Labels uppercase, badges |
| `text-xs` | 12px | 16px | Texto secundário pequeno |
| `text-sm` | 13px | 18px | Texto base (default do body) |
| `text-base` | 14px | 20px | Texto levemente maior |
| `text-lg` | 16px | 24px | Subtítulos |
| `text-xl` | 18px | 28px | Títulos de seção |
| `text-2xl` | 22px | 28px | Títulos de página (mobile) |
| `text-3xl` | 28px | 32px | Títulos de página (desktop) |
| `text-4xl` | 36px | 40px | Hero, login split |
| `text-5xl` | 48px | 1.1 | Hero large (login desktop) |

### Pesos

- Display: 500 / 600 / 700 (Space Grotesk)
- UI: 400 / 500 / 600 / 700 (Inter)
- Mono: 400 / 500

## Espaçamento

Escala 4px-based (Tailwind default). Os mais usados no admin:

| Classe | Valor | Uso |
|---|---|---|
| `gap-1` / `p-1` | 4px | Badges, ícones |
| `gap-2` / `p-2` | 8px | Dentro de botões, cards pequenos |
| `gap-3` / `p-3` | 12px | Padding de botões médios |
| `gap-4` / `p-4` | 16px | Padding de cards |
| `gap-6` / `p-6` | 24px | Padding de seções |
| `gap-8` / `p-8` | 32px | Entre seções |

## Raios (border-radius)

| Token | Valor | Uso |
|---|---|---|
| `rounded-sm` | 4px | Badges pequenos, chips |
| `rounded-md` | 8px (default) | Botões, inputs, badges |
| `rounded-lg` | 12px | Cards |
| `rounded-xl` | 16px | Cards grandes, modais |
| `rounded-2xl` | 20px | Modais, painéis especiais |
| `rounded-full` | 9999px | Avatares, badges circulares, pills |

O `--radius` base é `0.625rem` (10px). Todos os outros derivam.

## Sombras (elevação)

| Token | Uso |
|---|---|
| `shadow-elev-0` | Sem sombra (default) |
| `shadow-elev-1` | Cards normais, botões |
| `shadow-elev-2` | Hover de botões, dropdowns |
| `shadow-elev-3` | Cards hover, modais, popovers |
| `shadow-elev-4` | Drag, drag-and-drop |
| `shadow-elev-5` | Modais, command palette |
| `shadow-glow-sm` | Foco suave com cor primária |
| `shadow-glow` | Foco médio (botões CTA) |
| `shadow-glow-lg` | Hover de CTAs (gradient button) |
| `shadow-inner-glow` | Inner highlight (cards dark mode) |

## Animações

### Easings customizados

| Token | Cubic-bezier | Uso |
|---|---|---|
| `ease-spring` | `(0.16, 1, 0.3, 1)` | Entrada de modais, cards |
| `ease-bounce` | `(0.34, 1.56, 0.64, 1)` | Confirmações, success states |

### Keyframes disponíveis

| Animação | Duração | Uso |
|---|---|---|
| `fade-in` | 200ms | Entrada de conteúdo |
| `fade-in-fast` | 120ms | Hover, focus |
| `slide-in-right` | 200ms | Toast, notifications |
| `slide-in-from-top` | 180ms | Dropdowns, selects |
| `slide-in-from-bottom` | 200ms | Sheets, drawers |
| `scale-in` | 150ms | Modais, popovers |
| `pulse-soft` | 2s loop | Loading states, live indicators |
| `shimmer` | 2.4s loop | Skeleton loaders |
| `shimmer-bg` | 1.6s loop | Background subtle animation |
| `drawer-in` | 240ms | Side panels |

## Gradientes

| Classe | Uso |
|---|---|
| `bg-gradient-primary` | Botões premium, brand mark |
| `bg-gradient-radial` | Hero backgrounds, login |
| `bg-gradient-mesh` | Backgrounds decorativos (admin) |
| `text-gradient-primary` | Títulos com gradiente (hero login) |
| `bg-grid-32` | Padrão de grid sutil |
| `bg-dot-24` | Padrão de pontos (admin) |

## Border (especiais)

| Classe | Uso |
|---|---|
| `border-border` | Default (sutil) |
| `border-border/60` | Mais sutil |
| `border-primary/20` | Destaque primário |
| `border-success/30` | Status success |
| `border-danger/30` | Status danger |

## Como usar

```tsx
// No componente
<button className="bg-primary text-primary-foreground hover:bg-primary-hover shadow-elev-1">
  Ação
</button>

// Background
<div className="bg-surface border border-border rounded-xl shadow-elev-1">
  ...
</div>

// Status badge
<StatusBadge status="active" />  // verde
<StatusBadge status="expired" /> // vermelho
<StatusBadge status="pending" /> // amarelo

// Tipografia
<h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
  Título
</h1>
```

## Como customizar

Para mudar a cor primária do brand inteiro:

1. Abra `app/globals.css`
2. Troque os valores HSL de `--primary`, `--primary-hover`, `--primary-subtle`, `--primary-ring` em ambos `:root` (light) e `.dark`
3. Salve. Tudo atualiza automaticamente (botões, badges, focus rings, sparklines).

## Links relacionados

- [[Design-System-v2]]
- [[Componentes]]
- [[Direcao-Visual]]
