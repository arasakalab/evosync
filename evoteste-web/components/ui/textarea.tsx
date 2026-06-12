import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-border bg-[#0d1713] px-3 py-2 text-sm text-text",
          "placeholder:text-muted/60",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors resize-y",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
