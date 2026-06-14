import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "expired"
  | "suspended"
  | "revoked";

const variantConfig: Record<
  StatusVariant,
  {
    label?: string;
    icon: LucideIcon;
    classes: string;
  }
> = {
  active: {
    icon: CheckCircle2,
    classes:
      "bg-success-subtle text-success-foreground border-success/30 ring-1 ring-success/10",
  },
  success: {
    icon: CheckCircle2,
    classes:
      "bg-success-subtle text-success-foreground border-success/30 ring-1 ring-success/10",
  },
  inactive: {
    icon: CircleDot,
    classes: "bg-muted text-muted-foreground border-border",
  },
  neutral: {
    icon: CircleDot,
    classes: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    icon: Clock,
    classes:
      "bg-warning-subtle text-warning-foreground border-warning/30 ring-1 ring-warning/10",
  },
  warning: {
    icon: AlertTriangle,
    classes:
      "bg-warning-subtle text-warning-foreground border-warning/30 ring-1 ring-warning/10",
  },
  expired: {
    icon: AlertCircle,
    classes:
      "bg-danger-subtle text-danger-foreground border-danger/30 ring-1 ring-danger/10",
  },
  danger: {
    icon: XCircle,
    classes:
      "bg-danger-subtle text-danger-foreground border-danger/30 ring-1 ring-danger/10",
  },
  suspended: {
    icon: XCircle,
    classes:
      "bg-muted text-muted-foreground border-border line-through opacity-80",
  },
  revoked: {
    icon: XCircle,
    classes: "bg-muted text-muted-foreground border-border opacity-70",
  },
  info: {
    icon: Info,
    classes: "bg-info-subtle text-info-foreground border-info/30 ring-1 ring-info/10",
  },
};

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  withIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

/**
 * Mapeia status textuais comuns (do banco) para variants visuais.
 */
function autoMapStatus(status: string): StatusVariant {
  const s = status?.toLowerCase().trim();
  if (!s) return "neutral";
  if (s === "active" || s === "ativo" || s === "success" || s === "succeeded")
    return "active";
  if (s === "inactive" || s === "inativo") return "inactive";
  if (s === "pending" || s === "pendente" || s === "queued") return "pending";
  if (s === "expired" || s === "expirado" || s === "expirada") return "expired";
  if (s === "suspended" || s === "suspenso" || s === "paused") return "suspended";
  if (s === "revoked" || s === "revoked" || s === "cancelled" || s === "cancelado")
    return "revoked";
  if (s === "warning" || s === "warn" || s === "expiring") return "warning";
  if (s === "error" || s === "failed" || s === "erro" || s === "falha") return "danger";
  if (s === "info" || s === "informational") return "info";
  return "neutral";
}

export function StatusBadge({
  status,
  variant,
  withIcon = true,
  pulse,
  className,
}: StatusBadgeProps) {
  const v = variant ?? autoMapStatus(status);
  const config = variantConfig[v];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider",
        config.classes,
        className
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-1.5 w-1.5 rounded-full",
          v === "active" || v === "success" || v === "pending"
            ? "bg-current"
            : v === "danger" || v === "expired"
            ? "bg-current"
            : "bg-current opacity-70",
          pulse && "animate-pulse-soft"
        )}
      />
      {withIcon && <Icon className="h-3 w-3" />}
      <span>{status}</span>
    </span>
  );
}
