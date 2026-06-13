"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
            background: "#f8fafc",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <AlertTriangle
              size={56}
              style={{ color: "#dc2626", margin: "0 auto 1rem" }}
            />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
              Algo deu muito errado
            </h1>
            <p style={{ color: "#64748b", margin: "0 0 1.5rem" }}>
              Um erro inesperado impediu a página de carregar. Nossa equipe foi
              notificada.
            </p>
            {error.digest && (
              <code
                style={{
                  display: "inline-block",
                  fontSize: 12,
                  background: "#f1f5f9",
                  padding: "0.25rem 0.5rem",
                  borderRadius: 4,
                  marginBottom: "1.5rem",
                }}
              >
                ref: {error.digest}
              </code>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Button onClick={reset}>
                <RefreshCw size={16} style={{ marginRight: 6 }} />
                Tentar de novo
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                <Home size={16} style={{ marginRight: 6 }} />
                Início
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
