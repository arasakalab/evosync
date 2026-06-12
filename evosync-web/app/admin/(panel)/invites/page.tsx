import { getDb, schema } from "@/lib/db";
import { desc, eq, and, isNull, gt } from "drizzle-orm";
import InvitesTable from "./table";
import CreateInviteDialog from "./create-dialog";

export const dynamic = "force-dynamic";

export default function AdminInvitesPage() {
  const db = getDb();
  const invites = db
    .select()
    .from(schema.invites)
    .orderBy(desc(schema.invites.createdAt))
    .all();
  const tenants = db
    .select()
    .from(schema.tenants)
    .all();
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Convites</h2>
          <p className="text-sm text-slate-500 mt-1">
            Emita um convite para que um operador (ou owner) se cadastre
            em um tenant. O link expira em 7 dias.
          </p>
        </div>
        <CreateInviteDialog tenants={tenants.filter((t) => t.status === "active")} />
      </div>

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
