"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "transition-all duration-200 ease-spring",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-elev-1 hover:bg-primary-hover hover:shadow-elev-2 hover:shadow-primary/20",
        secondary:
          "bg-surface text-foreground border border-border shadow-elev-1 hover:bg-surface-alt hover:border-border/60",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-alt hover:border-border/80",
        ghost:
          "text-foreground hover:bg-surface-alt hover:text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-danger text-white shadow-elev-1 hover:bg-danger/90 hover:shadow-elev-2",
        success:
          "bg-success text-white shadow-elev-1 hover:bg-success/90",
        gradient:
          "bg-gradient-primary text-white shadow-elev-1 hover:shadow-elev-2 hover:shadow-primary/30",
        glass:
          "glass text-foreground border border-border/50 hover:bg-surface/80",
        // legacy
        blue: "bg-info text-white shadow-elev-1 hover:bg-info/90",
        danger:
          "bg-danger text-white shadow-elev-1 hover:bg-danger/90",
        neutral:
          "bg-muted text-foreground border border-border hover:bg-muted/70",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-xs gap-1.5",
        lg: "h-11 px-6 text-base",
        xl: "h-12 px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
