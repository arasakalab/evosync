"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Counts {
  tenants: number;
  users: number;
  licenses: number;
  invites: number;
  contacts: number;
  contactLists: number;
  schedules: number;
  sentLog: number;
  auditLog: number;
  superAdmins: number;
}

interface ResetDatabaseProps {
  counts: Counts;
}

const REQUIRED_PHRASE = "ZERAR";

export function ResetDatabase({ counts }: ResetDatabaseProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupPath, setBackupPath] = useState<string | null>(null);

  const totalToWipe =
    counts.tenants +
    counts.users -
    counts.superAdmins + // preserva super admins
    counts.licenses +
    counts.invites +
    counts.contacts +
    counts.contactLists +
    counts.schedules +
    counts.sentLog +
    counts.auditLog;

  function reset() {
    setStep(1);
    setConfirmation("");
    setPassword("");
    setShowPassword(false);
    setLoading(false);
    setBackupPath(null);
  }

  function handleOpenChange(o: boolean) {
    if (loading) return; // não fecha durante operação
    setOpen(o);
    if (!o) {
      // pequena pausa para UX não cortar
      setTimeout(reset, 200);
    }
  }

  async function doReset() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao zerar banco", {
          description: data.details,
        });
        setLoading(false);
        return;
      }
      setBackupPath(data.backupPath);
      setStep(3);
      toast.success("Banco zerado com sucesso");
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
      {/* Trigger card */}
      <div className="rounded-xl border border-danger/30 bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-subtle ring-1 ring-danger/20">
            <Database className="h-5 w-5 text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground font-display">
              Zerar banco de dados
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Apaga <strong>todos os tenants, usuários, contatos, agendamentos e logs</strong>.
              Os <strong>super admins</strong> são preservados (você continua logado).
              É criado um backup automático antes, que pode ser restaurado manualmente.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SummaryPill label="Tenants" value={counts.tenants} />
              <SummaryPill label="Usuários" value={counts.users - counts.superAdmins} hint="não-super" />
              <SummaryPill label="Contatos" value={counts.contacts} />
              <SummaryPill label="Agendamentos" value={counts.schedules} />
              <SummaryPill label="Envios (log)" value={counts.sentLog} />
              <SummaryPill label="Audit" value={counts.auditLog} />
            </div>
            <div className="mt-4">
              <Button
                variant="destructive"
                onClick={() => {
                  reset();
                  setOpen(true);
                }}
                disabled={totalToWipe === 0 && counts.auditLog === 0}
              >
                <RotateCcw className="h-4 w-4" />
                Zerar banco
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-step dialog */}
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
                  {step === 3 && "Banco zerado"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {step === 1 &&
                    "Esta ação é IRREVERSÍVEL. Um backup será criado antes, mas prossiga apenas se tiver certeza."}
                  {step === 2 &&
                    "Por segurança, digite a frase ZERAR e sua senha de admin."}
                  {step === 3 &&
                    "Tudo limpo. Recomendamos logout/login para sincronizar a sessão."}
                </DialogDescription>
              </div>
            </div>

            {/* Stepper visual */}
            {step !== 3 && (
              <div className="flex items-center gap-2 pt-3">
                <StepDot active={step === 1} done={step > 1} label="1. Aviso" />
                <div className="h-px flex-1 bg-border" />
                <StepDot active={step === 2} label="2. Confirmar" />
              </div>
            )}
          </DialogHeader>

          {/* === STEP 1: Aviso detalhado === */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-danger/30 bg-danger-subtle/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  O que será apagado:
                </h4>
                <ul className="space-y-1.5 text-sm">
                  <WipeRow label="Tenants (empresas)" count={counts.tenants} />
                  <WipeRow
                    label="Usuários (owners e operators)"
                    count={counts.users - counts.superAdmins}
                  />
                  <WipeRow label="Licenças" count={counts.licenses} />
                  <WipeRow label="Convites pendentes" count={counts.invites} />
                  <WipeRow label="Contatos (catálogo)" count={counts.contacts} />
                  <WipeRow label="Listas de contatos" count={counts.contactLists} />
                  <WipeRow label="Agendamentos" count={counts.schedules} />
                  <WipeRow label="Histórico de envios" count={counts.sentLog} />
                  <WipeRow label="Log de auditoria" count={counts.auditLog} />
                </ul>
              </div>

              <div className="rounded-lg border border-success/30 bg-success-subtle/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  O que será preservado:
                </h4>
                <ul className="space-y-1 text-sm text-foreground/80">
                  <li>• {counts.superAdmins} super admin(s) — você continua logado</li>
                  <li>• Arquivos de mídia enviados (uploads/ no disco)</li>
                </ul>
              </div>

              <div className="rounded-lg border border-info/30 bg-info-subtle/50 p-4 text-sm text-foreground/80">
                <strong className="text-foreground">Backup automático:</strong>{" "}
                um snapshot do SQLite será salvo em{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  ./data/backups/evosync-pre-reset-AAAAMMDD_HHMMSS.db
                </code>{" "}
                antes do wipe. Se algo der errado, o backup pode ser restaurado
                manualmente.
              </div>
            </div>
          )}

          {/* === STEP 2: Confirmação typed + senha === */}
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
                    confirmation && !confirmationValid &&
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
                  Confirmação extra contra sessão deixada aberta.
                </p>
              </div>
            </div>
          )}

          {/* === STEP 3: Sucesso === */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-subtle/50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Check className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    Banco zerado com sucesso
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Backup salvo. Você pode restaurar manualmente se precisar.
                  </p>
                </div>
              </div>

              {backupPath && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Backup
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

              <div className="rounded-lg border border-info/30 bg-info-subtle/50 p-4 text-sm text-foreground/80">
                <strong className="text-foreground">Recomendação:</strong> faça
                logout e login novamente para a sessão sincronizar com o banco
                zerado.
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
                  disabled={totalToWipe === 0 && counts.auditLog === 0}
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
                  onClick={doReset}
                  disabled={!canSubmit}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Zerando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Zerar permanentemente
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 3 && (
              <Button
                onClick={() => {
                  handleOpenChange(false);
                  // Recarrega a página para o server-side refetch ver os dados zerados
                  router.refresh();
                }}
              >
                <Check className="h-4 w-4" />
                Pronto
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryPill({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium",
        value > 0
          ? "border-border bg-surface text-foreground"
          : "border-border/50 bg-surface/50 text-muted-foreground"
      )}
    >
      <span className="font-mono tabular-nums">{value.toLocaleString("pt-BR")}</span>
      <span className="text-muted-foreground">{label}</span>
      {hint && <span className="text-2xs text-muted-foreground/70">({hint})</span>}
    </span>
  );
}

function WipeRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-center justify-between text-foreground/80">
      <span className="flex items-center gap-2">
        <X className="h-3.5 w-3.5 text-danger" />
        {label}
      </span>
      <span className="font-mono tabular-nums text-2xs text-muted-foreground">
        {count.toLocaleString("pt-BR")}
      </span>
    </li>
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
        {done ? <Check className="h-3 w-3" /> : label.charAt(0)}
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
