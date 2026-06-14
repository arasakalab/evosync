import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-foreground",
          "placeholder:text-muted-foreground/60",
          "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "hover:border-border/80",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
