import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
    "transition-colors",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary-subtle text-primary border border-primary/20",
        secondary:
          "bg-muted text-foreground border border-border",
        outline: "border border-border text-foreground bg-transparent",
        success:
          "bg-success-subtle text-success-foreground border border-success/20",
        warning:
          "bg-warning-subtle text-warning-foreground border border-warning/20",
        danger:
          "bg-danger-subtle text-danger-foreground border border-danger/20",
        info:
          "bg-info-subtle text-info-foreground border border-info/20",
        muted:
          "bg-muted text-muted-foreground border border-border",
        // legacy
        blue: "bg-info-subtle text-info-foreground border border-info/20",
        warn: "bg-warning-subtle text-warning-foreground border border-warning/20",
        "danger-soft": "bg-danger-subtle text-danger-foreground border border-danger/20",
      },
      size: {
        default: "text-xs px-2.5 py-0.5",
        sm: "text-2xs px-2 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
