---
tipo: design-system
tags: [evosync, design-system, componentes, catalogo]
criado: 2026-06-14
status: ativo
---

# Catálogo de Componentes

> Todos os componentes do design system v2, com path, propósito e quando usar.

## UI Primitives (em `components/ui/`)

Estes são os blocos básicos. Use em qualquer lugar do app.

| Componente | Path | Variants | Quando usar |
|---|---|---|---|
| **Button** | `components/ui/button.tsx` | `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`, `success`, `gradient`, `glass` + sizes (sm/default/lg/xl/icon) | Qualquer ação clicável |
| **Card** | `components/ui/card.tsx` | `default`, `elevated`, `outline`, `ghost` | Container de conteúdo, painéis |
| **Badge** | `components/ui/badge.tsx` | `default`, `secondary`, `outline`, `success`, `warning`, `danger`, `info`, `muted` | Status, contadores, tags |
| **Input** | `components/ui/input.tsx` | — | Campos de texto, email, number, etc. |
| **Dialog** | `components/ui/dialog.tsx` | sizes `sm`, `default`, `lg`, `xl` | Modais, confirmações |
| **Command** | `components/ui/command.tsx` | — | Command palette (base) |
| **Kbd** | `components/ui/kbd.tsx` | — | Atalhos de teclado (⌘K, etc.) |
| **Sonner** | `components/ui/sonner.tsx` | richColors | Toasts |
| **Tooltip** | `components/ui/tooltip.tsx` | — | Dicas em hover |
| **Popover** | `components/ui/popover.tsx` | — | Popovers anchored |
| **Dropdown Menu** | `components/ui/dropdown-menu.tsx` | — | Menus suspensos |
| **Select** | `components/ui/select.tsx` | — | Listas de seleção |
| **Switch** | `components/ui/switch.tsx` | — | Toggles booleanos |
| **Checkbox** | `components/ui/checkbox.tsx` | — | Caixas de seleção |
| **Tabs** | `components/ui/tabs.tsx` | — | Abas |
| **Scroll Area** | `components/ui/scroll-area.tsx` | — | Áreas com scroll customizado |
| **Separator** | `components/ui/separator.tsx` | — | Divisores visuais |
| **Progress** | `components/ui/progress.tsx` | — | Barras de progresso |
| **Alert Dialog** | `components/ui/alert-dialog.tsx` | — | Alertas críticos |
| **Textarea** | `components/ui/textarea.tsx` | — | Áreas de texto multi-linha |
| **Label** | `components/ui/label.tsx` | — | Labels de formulário |

## Admin Components (em `components/admin/`)

Componentes específicos do painel administrativo. Mais opinião embutida.

### `<StatCard>` — `components/admin/stat-card.tsx`

Card de KPI com ícone, valor, trend %, sparkline, e decorative gradient orb.

```tsx
<StatCard
  label="Tenants"
  value={tenants.length}
  sub={`${active} ativos`}
  icon={Building2}
  tone="primary"
  sparkline={[10, 20, 15, 30, 25, 40]}
  trend={{ value: 12.5, label: "vs. mês ant." }}
/>
```

**Tones disponíveis:** `primary`, `info`, `success`, `warning`, `danger`, `neutral`

### `<PageHeader>` — `components/admin/page-header.tsx`

Cabeçalho padronizado para todas as páginas. Título grande + descrição + breadcrumb + ações.

```tsx
<PageHeader
  title="Empresas (Tenants)"
  description="Gerencie os tenants cadastrados..."
  breadcrumbs={[
    { label: "Admin", href: "/admin" },
    { label: "Empresas" },
  ]}
  badge={<Badge>...</Badge>}
  actions={
    <Button>
      <Plus /> Nova empresa
    </Button>
  }
/>
```

### `<StatusBadge>` — `components/admin/status-badge.tsx`

Badge com auto-detecção de status. Mapeia "active" → verde, "expired" → vermelho, "pending" → amarelo, etc.

```tsx
<StatusBadge status="active" />      // verde
<StatusBadge status="expired" />     // vermelho
<StatusBadge status="pending" />     // amarelo
<StatusBadge status="suspended" />   // cinza strikethrough
<StatusBadge status="revoked" />     // cinza
<StatusBadge status={t.status} pulse={true} />  // com pulse animation
```

**Auto-map:** reconhece `ativo`, `pendente`, `expirado`, `suspenso`, `cancelado`, `error`, etc.

### `<EmptyState>` — `components/admin/empty-state.tsx`

Estado vazio reutilizável. 3 variants: `default`, `card`, `minimal`.

```tsx
<EmptyState
  icon={Building2}
  title="Nenhum tenant cadastrado"
  description="Crie o primeiro tenant para começar."
  action={<Button>Criar tenant</Button>}
  variant="card"  // ou "default" (com borda dashed) ou "minimal"
/>
```

### `<ConfirmDialog>` — `components/admin/confirm-dialog.tsx`

Modal de confirmação com ícone semântico e tom.

```tsx
<ConfirmDialog
  open={!!deleting}
  onOpenChange={(o) => !o && setDeleting(null)}
  title="Deletar tenant"
  description="Esta ação é irreversível."
  confirmText="Deletar"
  tone="danger"  // ou "warning", "info", "success"
  onConfirm={handleDelete}
/>
```

### `<CommandPalette>` — `components/admin/command-palette.tsx`

Command palette (⌘K) com navegação, ações e troca de tema. Veja o [README](#) ou `app/admin/(panel)/layout.tsx` para uso.

```tsx
<CommandPalette user={user} />
```

Para acionar programaticamente:
- `⌘K` ou `Ctrl+K` em qualquer lugar do admin
- `Esc` para fechar

### `<AdminShell>` — `components/admin/admin-shell.tsx`

Shell do painel: sidebar + topbar glass + main area com padding. **Já inclui** ThemeToggle no topbar e CommandPalette trigger.

```tsx
<AdminShell user={...} stats={...}>
  {children}
</AdminShell>
```

Props `stats`:
```ts
{
  tenants: number;
  activeTenants: number;
  users: number;
  expiringSoon: number;
  expiringCritically: number;  // badge na nav
  pendingInvites: number;       // badge na nav
}
```

## Theme

### `<ThemeProvider>` — `components/theme-provider.tsx`

Wrapper do `next-themes`. Já está no root layout.

### `<ThemeToggle>` — `components/theme-toggle.tsx`

Botão com dropdown (claro / escuro / sistema). Ícone animado Sun↔Moon.

```tsx
<ThemeToggle />
```

## Helpers (CSS classes)

Em `globals.css` (camada `@layer components`):

| Classe | Uso |
|---|---|
| `.card-elevated` | Card com sombra forte |
| `.card-interactive` | Card com hover lift (translate-y) |
| `.input-base` | Estilo base de input (legacy) |
| `.focus-ring` | Focus ring padronizado |
| `.shimmer` | Skeleton loader animation |
| `.glass` | Header com blur sutil |
| `.glass-strong` | Header com blur mais forte |
| `.bg-dotgrid` | Background com padrão de pontos |
| `.bg-grid` | Background com grid sutil |
| `.text-gradient-primary` | Texto com gradiente |

## Como adicionar um novo componente

1. **Primitive novo** (ex: Slider, Calendar, Combobox) → `components/ui/<nome>.tsx`
   - Use Radix UI como base quando possível (a11y pronto)
   - CVA para variants
   - `cn()` para merge de classes
2. **Admin-specific** (ex: TenantCard, LicenseTimeline) → `components/admin/<nome>.tsx`
   - Pode usar os primitives de `ui/`
   - Mais opinião de design
3. **Documente aqui** (este arquivo)
4. **Documente no Obsidian** ([[Design-System-v2]])

## Padrão de uso

```tsx
// ❌ Não faça — classes hardcoded
<div className="bg-slate-800 border-slate-700 text-white">

// ✅ Faça — use tokens semânticos
<div className="bg-surface border-border text-foreground">
```

```tsx
// ❌ Não faça — botão com gradiente aleatório
<button className="bg-gradient-to-br from-purple-500 to-pink-500">

// ✅ Faça — use variant do design system
<Button variant="gradient">Salvar</Button>
```

```tsx
// ❌ Não faça — tabela crua
<table className="w-full text-sm">
  <thead className="bg-slate-50">

// ✅ Faça — use o pattern de TableHeader do Card
<Card>
  <CardContent className="p-0 overflow-hidden">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-surface-alt/40">
```

## Links relacionados

- [[Design-System-v2]] — visão geral
- [[Design-Tokens]] — cores, tipografia, espaçamento
- [[Direcao-Visual]] — por que essa direção
