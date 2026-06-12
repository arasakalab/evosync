"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Circle } from "lucide-react";

export function StatusBar() {
  const lastLog = useAppStore((s) => s.logs[s.logs.length - 1]);
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        d.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-panel/30 px-4 text-[11px] text-muted">
      <div className="flex items-center gap-2 min-w-0">
        <Circle className="h-1.5 w-1.5 fill-primary text-primary" />
        <span className="truncate">
          {lastLog ? lastLog.line : "Pronto"}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden md:inline">EvoTeste Web · Next.js</span>
        <span className="font-mono">{now}</span>
      </div>
    </footer>
  );
}
