"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const REQUIRED_PHRASE = "RESTAURAR";
const MAX_BYTES = 500 * 1024 * 1024;
const ACCEPT_EXTS = [".db", ".sqlite", ".sqlite3"];

interface InspectResult {
  valid: boolean;
  reason?: string;
  fileSize: number;
  fileName: string;
  tables: string[];
  counts: Record<string, number>;
  superAdminEmails: string[];
}

export function RestoreDatabase() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setConfirmation("");
    setPassword("");
    setShowPassword(false);
    setLoading(false);
    setBackupPath(null);
  }

  function handleOpenChange(o: boolean) {
    if (loading) return;
    setOpen(o);
    if (!o) setTimeout(reset, 200);
  }

  function isAcceptableFile(f: File): boolean {
    const lower = f.name.toLowerCase();
    return ACCEPT_EXTS.some((ext) => lower.endsWith(ext));
  }

  async function inspectFile(f: File) {
    if (!isAcceptableFile(f)) {
      toast.error("Extensão não suportada", {
        description: "Use .db, .sqlite ou .sqlite3",
      });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", {
        description: `Máximo ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB.`,
      });
      return;
    }

    setSelectedFile(f);
    setInspect(null);
    setInspecting(true);
    try {
      const fd = new FormData();
      fd.append("database", f);
      const res = await fetch("/api/admin/inspect-backup", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Falha ao inspecionar arquivo");
        setSelectedFile(null);
        return;
      }
      setInspect(data);
      if (data.valid) {
        toast.success("Arquivo válido", {
          description: `${data.superAdminEmails.length} super admin(s) encontrados`,
        });
      } else {
        toast.error("Arquivo inválido", {
          description: data.reason,
        });
      }
    } catch (err: any) {
      toast.error("Erro de rede", { description: err?.message });
      setSelectedFile(null);
    } finally {
      setInspecting(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) inspectFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function clearSelection() {
    setSelectedFile(null);
    setInspect(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function doRestore() {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("database", selectedFile);
      fd.append("password", password);
      fd.append("confirmation", confirmation);

      const res = await fetch("/api/admin/restore-database", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao restaurar", {
          description: data.details,
        });
        setLoading(false);
        return;
      }
      setBackupPath(data.backupPath);
      setStep(3);
      toast.success("Banco restaurado com sucesso");
    } catch (err: any) {
      toast.error("Erro de rede", { description: err?.message });
    } finally {
      setLoading(false);
    }
  }

  const confirmationValid = confirmation.trim() === REQUIRED_PHRASE;
  const passwordValid = password.length >= 4;
  const canSubmit = confirmationValid && passwordValid && !loading;

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-subtle ring-1 ring-warning/20">
            <RotateCcw className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground font-display">
              Restaurar banco de dados
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Faça upload de um arquivo{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                .db
              </code>{" "}
              de backup (criado pelo EvoSync) e substitua o banco atual.
              Um backup do estado atual é criado automaticamente antes.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                "mt-3 cursor-pointer rounded-lg border-2 border-dashed p-6",
                "flex flex-col items-center justify-center gap-2",
                "transition-colors duration-200",
                dragOver
                  ? "border-primary bg-primary-subtle/50"
                  : "border-border bg-surface-alt/30 hover:border-border/80 hover:bg-surface-alt/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_EXTS.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) inspectFile(f);
                }}
              />
              {inspecting ? (
                <>
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">
                    Inspecionando arquivo...
                  </p>
                </>
              ) : selectedFile && inspect ? (
                <SelectedFilePreview
                  file={selectedFile}
                  inspect={inspect}
                  onClear={clearSelection}
                />
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Arraste o arquivo aqui ou{" "}
                    <span className="text-primary underline-offset-2 hover:underline">
                      escolha do PC
                    </span>
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    .db, .sqlite ou .sqlite3 · até {MAX_BYTES / 1024 / 1024}MB
                  </p>
                </>
              )}
            </div>

            <div className="mt-4">
              <Button
                variant="default"
                onClick={() => {
                  if (!selectedFile) {
                    toast.error("Selecione um arquivo primeiro");
                    return;
                  }
                  if (!inspect?.valid) {
                    toast.error("Arquivo não passou na validação");
                    return;
                  }
                  reset();
                  setOpen(true);
                }}
                disabled={!inspect?.valid}
              >
                <FileUp className="h-4 w-4" />
                Restaurar este backup
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-step dialog (mesmo padrão do reset) */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex items-start gap-3 mb-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-subtle ring-1 ring-danger/20">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle>
                  {step === 1 && "Tem certeza?"}
                  {step === 2 && "Confirme sua identidade"}
                  {step === 3 && "Banco restaurado"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {step === 1 &&
                    "Esta ação é IRREVERSÍVEL. O banco atual será SUBSTITUÍDO pelo arquivo enviado. Um backup é criado antes."}
                  {step === 2 &&
                    "Por segurança, digite a frase RESTAURAR e sua senha de admin."}
                  {step === 3 &&
                    "Tudo pronto. Recomendamos logout/login para sincronizar a sessão."}
                </DialogDescription>
              </div>
            </div>

            {step !== 3 && (
              <div className="flex items-center gap-2 pt-3">
                <StepDot active={step === 1} done={step > 1} label="1. Aviso" />
                <div className="h-px flex-1 bg-border" />
                <StepDot active={step === 2} label="2. Confirmar" />
              </div>
            )}
          </DialogHeader>

          {/* STEP 1: Aviso com preview do arquivo */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              {inspect && selectedFile && (
                <>
                  <div className="rounded-lg border border-info/30 bg-info-subtle/40 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Database className="h-4 w-4 text-info" />
                      Conteúdo do arquivo enviado
                    </h4>
                    <dl className="space-y-1 text-sm">
                      <DefRow
                        label="Nome"
                        value={selectedFile.name}
                        mono
                      />
                      <DefRow
                        label="Tamanho"
                        value={`${(selectedFile.size / 1024).toFixed(1)} KB`}
                      />
                      <DefRow
                        label="Total de tabelas"
                        value={`${inspect.tables.length}`}
                      />
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <CountPill label="Tenants" value={inspect.counts.tenants ?? 0} />
                      <CountPill label="Usuários" value={inspect.counts.users ?? 0} />
                      <CountPill label="Licenças" value={inspect.counts.licenses ?? 0} />
                      <CountPill label="Convites" value={inspect.counts.invites ?? 0} />
                      <CountPill label="Contatos" value={inspect.counts.contacts ?? 0} />
                      <CountPill label="Agendamentos" value={inspect.counts.schedules ?? 0} />
                      <CountPill label="Envios" value={inspect.counts.sent_log ?? 0} />
                      <CountPill label="Audit" value={inspect.counts.audit_log ?? 0} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-success/30 bg-success-subtle/40 p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-success" />
                      Super admins que serão preservados
                    </h4>
                    <ul className="space-y-0.5 text-sm">
                      {inspect.superAdminEmails.map((email) => (
                        <li key={email} className="font-mono text-2xs text-foreground/80">
                          • {email}
                        </li>
                      ))}
                    </ul>
                    {selectedFile && (
                      <CurrentAdminWarning
                        currentEmail={inspect.superAdminEmails}
                      />
                    )}
                  </div>
                </>
              )}

              <div className="rounded-lg border border-danger/30 bg-danger-subtle/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-danger" />
                  O que acontece agora
                </h4>
                <ol className="space-y-1 text-sm text-foreground/80 list-decimal list-inside marker:text-danger">
                  <li>O banco atual é copiado para <code className="rounded bg-muted px-1 py-0.5 text-2xs font-mono">data/backups/evosync-pre-restore-AAAAMMDD_HHMMSS.db</code></li>
                  <li>A conexão do DB é fechada e o cache limpo</li>
                  <li>O arquivo enviado é movido para o lugar do banco</li>
                  <li>A próxima requisição reabre a conexão com os dados novos</li>
                  <li>Todas as sessões de usuários ficam inválidas (precisam logar de novo)</li>
                </ol>
              </div>
            </div>
          )}

          {/* STEP 2: Confirmação typed + senha */}
          {step === 2 && (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="confirmation" className="text-sm font-medium">
                  Digite{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold">
                    {REQUIRED_PHRASE}
                  </code>{" "}
                  para confirmar
                </Label>
                <Input
                  id="confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={REQUIRED_PHRASE}
                  autoComplete="off"
                  autoFocus
                  className={cn(
                    "font-mono",
                    confirmation &&
                      !confirmationValid &&
                      "border-danger/50 focus:border-danger focus:ring-danger/30"
                  )}
                />
                {confirmation && !confirmationValid && (
                  <p className="text-2xs text-danger-foreground">
                    Digite exatamente &quot;{REQUIRED_PHRASE}&quot; (sem aspas).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Sua senha de admin
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-2xs text-muted-foreground">
                  Defesa contra sessão deixada aberta.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Sucesso */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-subtle/50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    Banco restaurado com sucesso
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Backup do estado anterior salvo. Você pode restaurar
                    manualmente se precisar reverter.
                  </p>
                </div>
              </div>

              {backupPath && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Backup do estado anterior
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground overflow-x-auto">
                      {backupPath}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(backupPath);
                        toast.success("Caminho copiado");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-warning/30 bg-warning-subtle/40 p-4 text-sm text-foreground/80">
                <strong className="text-foreground">Recomendação:</strong>{" "}
                faça logout e login novamente. Todas as sessões de outros
                usuários também precisarão relogar.
              </div>
            </div>
          )}

          <DialogFooter>
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setStep(2)}
                  disabled={!inspect?.valid}
                >
                  Continuar
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  onClick={doRestore}
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Restaurando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Restaurar permanentemente
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 3 && (
              <Button
                onClick={() => {
                  handleOpenChange(false);
                  clearSelection();
                  router.refresh();
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Pronto
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelectedFilePreview({
  file,
  inspect,
  onClear,
}: {
  file: File;
  inspect: InspectResult;
  onClear: () => void;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Database className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-foreground truncate">
            {file.name}
          </div>
          <div className="text-2xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="font-mono">
              {(file.size / 1024).toFixed(1)} KB
            </span>
            <span>·</span>
            <span>
              {inspect.tables.length} tabelas
            </span>
            <span>·</span>
            <span
              className={cn(
                "font-medium",
                inspect.valid
                  ? "text-success-foreground"
                  : "text-danger-foreground"
              )}
            >
              {inspect.valid ? "✓ válido" : "✗ inválido"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Remover arquivo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {inspect.valid && (
        <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
          <CountPill label="Tenants" value={inspect.counts.tenants ?? 0} />
          <CountPill label="Contatos" value={inspect.counts.contacts ?? 0} />
          <CountPill label="Envios" value={inspect.counts.sent_log ?? 0} />
          <CountPill
            label="Super admins"
            value={inspect.superAdminEmails.length}
            variant="info"
          />
        </div>
      )}
    </div>
  );
}

function CurrentAdminWarning({ currentEmail }: { currentEmail: string[] }) {
  // O email do admin atual é passado via session — mas como simplificação,
  // mostramos um aviso genérico se houver apenas 1 super admin no arquivo.
  if (currentEmail.length > 1) return null;
  return (
    <p className="text-2xs text-warning-foreground mt-2 flex items-start gap-1.5">
      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
      Este arquivo contém apenas 1 super admin. Se não for o seu email,
      você perderá acesso.
    </p>
  );
}

function DefRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-foreground/80">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-foreground", mono && "font-mono text-2xs")}>
        {value}
      </dd>
    </div>
  );
}

function CountPill({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: number;
  variant?: "neutral" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium",
        variant === "info"
          ? "border-info/20 bg-info-subtle text-info-foreground"
          : "border-border bg-muted text-foreground"
      )}
    >
      <span className="font-mono tabular-nums">
        {value.toLocaleString("pt-BR")}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active?: boolean;
  done?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-2xs font-mono font-bold transition-colors",
          done
            ? "bg-success text-white"
            : active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground border border-border"
        )}
      >
        {done ? <CheckCircle2 className="h-3 w-3" /> : label.charAt(0)}
      </div>
      <span
        className={cn(
          "text-xs",
          active || done ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label.replace(/^\d+\.\s/, "")}
      </span>
    </div>
  );
}
