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
          "flex h-10 w-full rounded-md border border-border bg-[#0d1713] px-3 py-2 text-sm text-text",
          "placeholder:text-muted/60",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
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
