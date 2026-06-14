import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import InvitesTable from "./table";
import CreateInviteDialog from "./create-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminInvitesPage() {
  const db = getDb();
  const invites = db
    .select()
    .from(schema.invites)
    .orderBy(desc(schema.invites.createdAt))
    .all();
  const tenants = db.select().from(schema.tenants).all();
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Convites"
        description="Emita um convite para que um operador (ou owner) se cadastre em um tenant. O link expira em 7 dias."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Convites" },
        ]}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-subtle border border-warning/20 px-2.5 py-0.5 text-2xs font-medium text-warning-foreground">
            <UserPlus className="h-3 w-3" />
            {invites.filter((i) => !i.usedAt).length} pendente(s)
          </span>
        }
        actions={
          <CreateInviteDialog tenants={tenants.filter((t) => t.status === "active")} />
        }
      />

      <InvitesTable
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          status: !i.usedAt
            ? "pending"
            : i.usedAt.startsWith("revoked:")
            ? "revoked"
            : "accepted",
          tenantId: i.tenantId,
          tenantName: tenantById.get(i.tenantId)?.name || "(removido)",
          tenantSlug: tenantById.get(i.tenantId)?.slug || "—",
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        }))}
      />
    </div>
  );
}
