---
tipo: design-system
tags: [evosync, design-system, tokens, visao-geral]
criado: 2026-06-14
status: ativo
---

# Design System EvoSync v2

> Documentação do redesign do painel administrativo. Tokens, decisões
> visuais, componentes e como o sistema se conecta.

## TL;DR

- **Direção:** Linear / Vercel minimal com pitada de glassmorphism no chrome
- **Tema default:** Dark (segue app do operador, é a cara da marca)
- **Tema alternativo:** Light (toggle no topbar, com `next-themes`)
- **Cor de acento:** Verde EvoSync (`#1f9d65` ≈ `hsl(158 64% 36%)`)
- **Fonte:** Inter (UI) + Space Grotesk (display) + JetBrains Mono (código)
- **Stack:** Tailwind 3.4 + CSS variables (HSL) + shadcn/ui + lucide-react
- **Dependências novas:** `recharts` (gráficos), `next-themes` (tema), `cmdk` (⌘K)

## Decisão de design (por que essa direção)

| Contexto | Decisão |
|---|---|
| App do operador já é dark | Admin segue **dark default** → coerência entre os 2 |
| Paleta existente é verde + neutral | Mantém a **identidade EvoSync** (não troca por azul/roxo) |
| Admin anterior misturava light/dark | Resolve a **inconsistência visual** (login dark, painel light) |
| Sem identidade própria (slate/indigo genérico) | Adiciona **brand mark** (3 nós conectados), tipografia display |
| Pouca hierarquia visual | Elevação em **5 níveis** + sombras com glow sutil da cor primária |
| Sem microinterações | Adiciona **animações spring** (cubic-bezier 0.16, 1, 0.3, 1) + `active:scale-[0.98]` |

## Estrutura

| Documento | Conteúdo |
|---|---|
| [[Design-Tokens]] | Cores, tipografia, espaçamento, sombras, raios, animações |
| [[Componentes]] | Catálogo dos componentes do design system |
| [[Direcao-Visual]] | Por que Linear + Vercel (referências, anti-referências) |

## Arquivos modificados (raiz do redesign)

### Infraestrutura
- `evosync-web/tailwind.config.ts` — paleta expandida, animações, sombras
- `evosync-web/app/globals.css` — CSS variables (light/dark), base layer
- `evosync-web/app/layout.tsx` — ThemeProvider, Space Grotesk
- `evosync-web/components/providers.tsx` — wrap com next-themes
- `evosync-web/components/theme-provider.tsx` — **novo**
- `evosync-web/components/theme-toggle.tsx` — **novo**

### UI primitives (atualizados)
- `evosync-web/components/ui/button.tsx` — mais variants (gradient, glass, success)
- `evosync-web/components/ui/card.tsx` — variants (default, elevated, outline, ghost)
- `evosync-web/components/ui/badge.tsx` — variants semânticas
- `evosync-web/components/ui/input.tsx` — mais polido
- `evosync-web/components/ui/dialog.tsx` — sizes (sm/default/lg/xl) + animação
- `evosync-web/components/ui/command.tsx` — **novo** (cmdk wrapper)
- `evosync-web/components/ui/kbd.tsx` — **novo**

### Componentes admin (novos)
- `evosync-web/components/admin/stat-card.tsx` — KPI card com sparkline
- `evosync-web/components/admin/page-header.tsx` — título + breadcrumbs + actions
- `evosync-web/components/admin/status-badge.tsx` — badge semântico com auto-map
- `evosync-web/components/admin/empty-state.tsx` — estado vazio com ilustração
- `evosync-web/components/admin/confirm-dialog.tsx` — modal de confirmação
- `evosync-web/components/admin/command-palette.tsx` — ⌘K
- `evosync-web/components/admin/admin-shell.tsx` — **redesenhado** (glass, theme toggle, ⌘K)

### Telas redesenhadas
- `app/admin/login/page.tsx` — split-screen
- `app/admin/(panel)/page.tsx` — dashboard com StatCards + sparklines + Resumo
- `app/admin/(panel)/tenants/*` — filtros pill, dropdown menu, ConfirmDialog
- `app/admin/(panel)/licenses/*` — filtros pill, dropdown de dias rápidos
- `app/admin/(panel)/invites/*` — wizard de 2 passos (criar + mostrar link)
- `app/admin/(panel)/users/*` — cards com avatares gerados
- `app/admin/(panel)/audit/*` — timeline visual (não tabela)

### Operador (alinhado)
- `components/layout/sidebar.tsx` — novo brand mark + indicador de página ativa
- `components/layout/header.tsx` — glass topbar + theme toggle

## Verificação

```bash
cd evosync-web
npx tsc --noEmit   # ✅ sem erros
npx next lint      # ✅ sem warnings
```

## Próximos passos (não feitos)

- [ ] Substituir sparklines demo do dashboard por dados reais (Recharts)
- [ ] Adicionar mais gráficos no dashboard (envios por dia, churn)
- [ ] Criar `Drawer` para side panel de detalhes do tenant
- [ ] Variantes `danger/glass` de mais componentes
- [ ] Storybook ou `/dev/design-system` (página de showcase)

## Links relacionados

- [[MOC-Raiz]] — entrada do vault
- [[MOC-SaaS-Web]] — mapa técnico do app web
- [[Visao-Geral]] — arquitetura
- [[ADR-004-Modelo-SaaS-Hospedado]] — modelo de negócio
