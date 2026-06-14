"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = theme === "system" ? resolvedTheme : theme;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground",
            className
          )}
          aria-label="Alternar tema"
        >
          {mounted ? (
            <>
              <Sun
                className={cn(
                  "h-4 w-4 transition-all duration-300",
                  current === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100"
                )}
              />
              <Moon
                className={cn(
                  "absolute h-4 w-4 transition-all duration-300",
                  current === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
                )}
              />
            </>
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[150px]">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={cn("gap-2 cursor-pointer", theme === "light" && "bg-primary/10 text-primary")}
        >
          <Sun className="h-4 w-4" />
          <span>Claro</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={cn("gap-2 cursor-pointer", theme === "dark" && "bg-primary/10 text-primary")}
        >
          <Moon className="h-4 w-4" />
          <span>Escuro</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={cn(
            "gap-2 cursor-pointer",
            theme === "system" && "bg-primary/10 text-primary"
          )}
        >
          <Monitor className="h-4 w-4" />
          <span>Sistema</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
