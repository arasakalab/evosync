"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setTheme("dark");
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-panel-alt group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-neutral group-[.toast]:text-text",
          error:
            "group-[.toaster]:bg-danger/10 group-[.toaster]:text-danger-soft group-[.toaster]:border-danger/30",
          success:
            "group-[.toaster]:bg-success/10 group-[.toaster]:text-success group-[.toaster]:border-success/30",
          warning:
            "group-[.toaster]:bg-warn/10 group-[.toaster]:text-warn group-[.toaster]:border-warn/30",
        },
      }}
      {...props}
    />
  );
}
