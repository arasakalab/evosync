import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "card" | "minimal";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-center",
          className
        )}
      >
        {Icon && (
          <Icon className="h-8 w-8 text-muted-foreground/40 mb-2" />
        )}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {action && <div className="mt-3">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12",
        variant === "card" && "rounded-xl border border-dashed border-border bg-surface-alt/50",
        className
      )}
    >
      {Icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary-subtle ring-1 ring-primary/20">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground font-display">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
