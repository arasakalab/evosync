"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Cable,
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Search,
  UserPlus,
  Users,
  Moon,
  Sun,
  Monitor,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

interface CommandPaletteProps {
  user?: { name: string | null; email: string };
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, keywords: ["início", "home", "visao geral"] },
  { label: "Empresas (Tenants)", href: "/admin/tenants", icon: Building2, keywords: ["empresa", "cliente", "tenant"] },
  { label: "Licenças", href: "/admin/licenses", icon: KeyRound, keywords: ["licenca", "vencimento", "renovar"] },
  { label: "Convites", href: "/admin/invites", icon: UserPlus, keywords: ["convite", "invite", "novo usuario"] },
  { label: "Usuários", href: "/admin/users", icon: Users, keywords: ["user", "operador", "conta"] },
  { label: "Auditoria", href: "/admin/audit", icon: ScrollText, keywords: ["log", "historico", "evento"] },
];

export function CommandPalette({ user }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="
          group flex items-center gap-2 h-9 px-3 rounded-lg
          border border-border bg-surface/60 text-muted-foreground
          hover:bg-surface hover:border-border/80 hover:text-foreground
          transition-all duration-200
          min-w-[200px] sm:min-w-[260px]
        "
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs flex-1 text-left">Buscar ou navegar...</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite um comando, página ou ação..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Navegação">
            {NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => go(item.href)}
                className="gap-3"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tema">
            <CommandItem
              value="tema claro light"
              onSelect={() => {
                setTheme("light");
                setOpen(false);
              }}
              className="gap-3"
            >
              <Sun className="h-4 w-4 text-muted-foreground" />
              <span>Tema claro</span>
              <CommandShortcut>☀</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="tema escuro dark"
              onSelect={() => {
                setTheme("dark");
                setOpen(false);
              }}
              className="gap-3"
            >
              <Moon className="h-4 w-4 text-muted-foreground" />
              <span>Tema escuro</span>
              <CommandShortcut>🌙</CommandShortcut>
            </CommandItem>
            <CommandItem
              value="tema sistema system"
              onSelect={() => {
                setTheme("system");
                setOpen(false);
              }}
              className="gap-3"
            >
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <span>Seguir sistema</span>
              <CommandShortcut>💻</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {user && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Sessão">
                <CommandItem
                  value="minha conta perfil"
                  onSelect={() => go("/admin")}
                  className="gap-3"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>{user.name || user.email}</span>
                </CommandItem>
                <CommandItem
                  value="sair logout"
                  onSelect={() => signOut({ callbackUrl: "/admin/login" })}
                  className="gap-3 text-danger"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
