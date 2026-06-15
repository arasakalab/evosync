"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  Folder,
  Info,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Card de backup do banco de dados. Permite ao super_admin baixar
 * um snapshot consistente do SQLite, escolhendo onde salvar.
 *
 * Estratégia de download (em ordem de preferência):
 *
 * 1. **File System Access API** (Chrome, Edge, Opera 86+):
 *    Abre o "Save As" nativo do SO. Usuário escolhe a pasta e o
 *    nome do arquivo. O conteúdo é escrito diretamente no destino.
 *
 * 2. **Fallback `<a download>`** (Firefox, Safari, etc):
 *    Cria um link invisível com atributo `download` apontando para
 *    a API. O browser dispara o download padrão. O usuário pode
 *    escolher "Save As" se preferir.
 *
 * Em ambos os casos, o browser recebe um stream do servidor e
 * grava no destino escolhido.
 */
export function BackupDatabase() {
  const [loading, setLoading] = useState(false);
  const [supportsPicker, setSupportsPicker] = useState<boolean | null>(null);
  const [lastSize, setLastSize] = useState<number | null>(null);

  // Detecta suporte ao File System Access API (só client-side)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupportsPicker(
      "showSaveFilePicker" in window && typeof (window as any).showSaveFilePicker === "function"
    );
  }, []);

  function suggestedName(): string {
    const d = new Date();
    const stamp = d
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace(/T/, "_")
      .slice(0, 19);
    return `evosync-backup-${stamp}.db`;
  }

  async function performBackup(): Promise<{ name: string; size: number } | null> {
    const name = suggestedName();
    const res = await fetch("/api/admin/backup-database", {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      let msg = "Falha ao gerar backup";
      try {
        const data = await res.json();
        msg = data.error || msg;
        if (data.details) msg += `: ${data.details}`;
      } catch {
        /* ignore */
      }
      toast.error(msg);
      return null;
    }
    const sizeHeader = res.headers.get("X-Backup-Size");
    const size = sizeHeader ? parseInt(sizeHeader, 10) : 0;
    setLastSize(size);
    return { name, size };
  }

  /**
   * Estratégia 1: File System Access API.
   * Abre o "Save As" nativo. Usuário escolhe pasta + nome.
   */
  async function backupWithPicker() {
    setLoading(true);
    try {
      // 1. Pede o "Save As" ANTES de gerar o backup (UX: prompt primeiro,
      //    operação depois, evita ficar com arquivo órfão se o user cancelar)
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: suggestedName(),
        types: [
          {
            description: "Banco SQLite (EvoSync)",
            accept: { "application/x-sqlite3": [".db"] },
          },
        ],
        excludeAcceptAllOption: false,
      });

      // 2. Agora gera o backup
      const meta = await performBackup();
      if (!meta) return;

      // 3. Re-fetch direto (não dá pra reusar a response do performBackup
      //    porque ela já foi consumida)
      const res2 = await fetch("/api/admin/backup-database", {
        method: "GET",
        credentials: "include",
      });
      if (!res2.ok || !res2.body) {
        toast.error("Falha ao transmitir backup");
        return;
      }

      // 4. Escreve o stream no arquivo escolhido
      const writable = await handle.createWritable();
      await res2.body.pipeTo(writable);

      toast.success("Backup salvo com sucesso", {
        description: handle.name || meta.name,
      });
    } catch (err: any) {
      // User cancelou o save dialog — silencioso
      if (err?.name === "AbortError") {
        return;
      }
      console.error("[backup] erro:", err);
      toast.error("Erro ao fazer backup", {
        description: err?.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Estratégia 2: Fallback via <a download>.
   * Funciona em qualquer browser. O user recebe o diálogo
   * de download padrão do browser, com "Save As" disponível.
   */
  async function backupWithDownload() {
    setLoading(true);
    try {
      // Para ter o nome certo no header Content-Disposition,
      // geramos o backup via fetch + blob (assim o nome sugerido
      // vem do servidor, fica consistente com a estratégia 1).
      const meta = await performBackup();
      if (!meta) return;

      const res2 = await fetch("/api/admin/backup-database", {
        method: "GET",
        credentials: "include",
      });
      if (!res2.ok) {
        toast.error("Falha ao transmitir backup");
        return;
      }

      const blob = await res2.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      // Cleanup após o browser processar
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      toast.success("Download iniciado", {
        description: "Use 'Salvar como' se quiser escolher a pasta.",
      });
    } catch (err: any) {
      console.error("[backup] erro:", err);
      toast.error("Erro ao fazer backup", {
        description: err?.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (supportsPicker) {
      backupWithPicker();
    } else {
      backupWithDownload();
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-subtle ring-1 ring-info/20">
          <Database className="h-5 w-5 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground font-display">
              Backup do banco de dados
            </h3>
            {supportsPicker && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle border border-success/20 px-2 py-0.5 text-2xs font-medium text-success-foreground">
                <Folder className="h-3 w-3" />
                Salvar em pasta
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gera um snapshot consistente do SQLite (incluindo dados
            pendentes do WAL) e baixa para o seu computador. Use antes
            de operações destrutivas ou para arquivar periodicamente.
          </p>

          {/* Notes */}
          <div className="mt-3 rounded-lg border border-info/30 bg-info-subtle/30 p-3 text-xs text-foreground/80">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>
                  {supportsPicker
                    ? "Seu navegador permite escolher a pasta de destino na hora de salvar."
                    : "Seu navegador baixa para a pasta padrão de downloads. Use 'Salvar como' para escolher outra pasta."}
                </p>
                {lastSize !== null && (
                  <p className="text-muted-foreground">
                    Último backup: <span className="font-mono">{(lastSize / 1024).toFixed(1)} KB</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button
              variant="default"
              onClick={handleClick}
              disabled={loading || supportsPicker === null}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  {supportsPicker ? (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar backup em...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Baixar backup
                    </>
                  )}
                </>
              )}
            </Button>
            {supportsPicker === false && (
              <span className="text-2xs text-muted-foreground">
                (detecção de pasta não suportada — use &quot;Salvar como&quot; no diálogo)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
