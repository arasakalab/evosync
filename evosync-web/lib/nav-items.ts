import {
  Cable,
  Users,
  MessageSquare,
  Send,
  CalendarClock,
  Palette,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  locked?: boolean;
};

export const APP_NAV_ITEMS: Omit<AppNavItem, "locked">[] = [
  { href: "/conexao", label: "Conexão", shortLabel: "Conexão", icon: Cable },
  { href: "/contatos", label: "Contatos", shortLabel: "Contatos", icon: Users },
  { href: "/mensagem", label: "Mensagem", shortLabel: "Msg", icon: MessageSquare },
  { href: "/disparo", label: "Disparo", shortLabel: "Disparo", icon: Send },
  { href: "/agenda", label: "Agenda", shortLabel: "Agenda", icon: CalendarClock },
  {
    href: "/customizar",
    label: "Personalizar",
    shortLabel: "Visual",
    icon: Palette,
  },
];
