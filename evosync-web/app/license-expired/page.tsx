import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, LogOut, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/lib/auth";
import { getLatestLicense, getActiveLicense } from "@/lib/license";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { formatDateTime } from "@/lib/utils";

export default async function LicenseExpiredPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login?callbackUrl=/");
  }

  // super_admin nunca vê esta página (é plataforma, não cliente)
  if (!session.user.tenantId) {
    redirect("/");
  }

  // Pega a license mais recente (ativa ou não) pra mostrar info útil
  const latest = await getLatestLicense(session.user.tenantId);
  const active = await getActiveLicense(session.user.tenantId);

  // Pega info do tenant
  const db = getDb();
  const tenant = db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, session.user.tenantId))
    .all()[0];

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warn/15 text-warn">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text">Licença vencida</h1>
              <p className="text-sm text-muted mt-1">
                {tenant ? (
                  <>A licença da empresa <strong className="text-text">{tenant.name}</strong> venceu.</>
                ) : (
                  <>A licença venceu.</>
                )}
              </p>
            </div>
          </div>

          {latest && (
            <div className="mt-4 rounded-md border border-border bg-panel/40 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Última licença:</span>
                <span className="text-text">
                  {formatDateTime(latest.issuedAt)} → {formatDateTime(latest.expiresAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status atual:</span>
                <span className={active ? "text-success" : "text-warn"}>
                  {active ? "Ativa" : latest.status === "revoked" ? "Revogada" : "Vencida"}
                </span>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2 text-sm text-text/90">
            <p className="font-medium">O que fazer agora?</p>
            <ol className="list-decimal list-inside space-y-1 text-muted">
              <li>Entre em contato com o administrador da plataforma</li>
              <li>Solicite a renovação da licença</li>
              <li>Aguarde a confirmação e faça login novamente</li>
            </ol>
          </div>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
            className="mt-6"
          >
            <Button type="submit" variant="neutral" className="w-full">
              <LogOut className="h-4 w-4" /> Sair da conta
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          EvoSync · Plataforma de disparos via Evolution API
        </p>
      </div>
    </div>
  );
}
