import { getDb, schema } from "@/lib/db";
import { count, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { ResetDatabase } from "./reset-database";
import { BackupDatabase } from "./backup-database";
import { RestoreDatabase } from "./restore-database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Database, RotateCcw, Settings, ShieldCheck, User } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * /admin/settings
 *
 * Configurações do super_admin. Atualmente tem só a "Zona de perigo" (zerar banco).
 * Esqueleto pronto para receber mais seções (preferências de notificação, etc).
 */
export default function AdminSettingsPage() {
  const db = getDb();

  // Coleta contagens para mostrar ao usuário o que será afetado
  const [
    tenants,
    users,
    licenses,
    invites,
    contacts,
    contactLists,
    schedules,
    sentLog,
    auditLog,
  ] = [
    db.select({ c: count() }).from(schema.tenants).get(),
    db.select({ c: count() }).from(schema.users).get(),
    db.select({ c: count() }).from(schema.licenses).get(),
    db.select({ c: count() }).from(schema.invites).get(),
    db.select({ c: count() }).from(schema.contacts).get(),
    db.select({ c: count() }).from(schema.contactLists).get(),
    db.select({ c: count() }).from(schema.schedules).get(),
    db.select({ c: count() }).from(schema.sentLog).get(),
    db.select({ c: count() }).from(schema.auditLog).get(),
  ];

  const superAdminCount = db
    .select({ c: count() })
    .from(schema.users)
    .where(eq(schema.users.role, "super_admin"))
    .get();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Preferências e ações administrativas do super admin."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Configurações" },
        ]}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2.5 py-0.5 text-2xs font-medium text-muted-foreground">
            <Settings className="h-3 w-3" />
            super admin
          </span>
        }
      />

      {/* === Conta === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Sua conta
          </CardTitle>
          <CardDescription>
            Você está logado como super admin global. Outros super admins
            não pertencem a nenhum tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-alt/50 p-4">
            <div>
              <div className="text-sm font-medium text-foreground">
                Total de super admins
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Contas com acesso irrestrito à plataforma.
              </div>
            </div>
            <Badge variant="default" className="text-base px-3 py-1">
              {superAdminCount?.c ?? 0}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* === Backup do banco === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-info" />
            Backup
          </CardTitle>
          <CardDescription>
            Baixe um snapshot do banco para o seu computador. Útil antes
            de operações destrutivas ou para arquivar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupDatabase />
        </CardContent>
      </Card>

      {/* === Restaurar banco === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-warning" />
            Restaurar
          </CardTitle>
          <CardDescription>
            Faça upload de um arquivo <code className="rounded bg-muted px-1 py-0.5 text-2xs font-mono">.db</code> de
            backup para substituir o banco atual. Backup automático antes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestoreDatabase />
        </CardContent>
      </Card>

      {/* === Zona de perigo: Zerar banco === */}
      <Card className="border-danger/30 bg-danger-subtle/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="h-4 w-4" />
            Zona de perigo
          </CardTitle>
          <CardDescription>
            Ações destrutivas e irreversíveis. Faça backup antes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetDatabase
            counts={{
              tenants: tenants?.c ?? 0,
              users: users?.c ?? 0,
              licenses: licenses?.c ?? 0,
              invites: invites?.c ?? 0,
              contacts: contacts?.c ?? 0,
              contactLists: contactLists?.c ?? 0,
              schedules: schedules?.c ?? 0,
              sentLog: sentLog?.c ?? 0,
              auditLog: auditLog?.c ?? 0,
              superAdmins: superAdminCount?.c ?? 0,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
