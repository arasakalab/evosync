import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import TenantsTable from "./table";
import CreateTenantDialog from "./create-dialog";

export const dynamic = "force-dynamic";

export default function AdminTenantsPage() {
  const db = getDb();
  const tenants = db
    .select()
    .from(schema.tenants)
    .orderBy(desc(schema.tenants.createdAt))
    .all();
  const users = db
    .select({
      id: schema.users.id,
      tenantId: schema.users.tenantId,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
    })
    .from(schema.users)
    .all();
  const licenses = db.select().from(schema.licenses).all();

  // Map: tenantId -> { userCount, latestLicense }
  const meta = new Map<
    string,
    { userCount: number; latestLicense: typeof schema.licenses.$inferSelect | null }
  >();
  for (const t of tenants) {
    const tUsers = users.filter((u) => u.tenantId === t.id);
    const tLicenses = licenses
      .filter((l) => l.tenantId === t.id)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    meta.set(t.id, {
      userCount: tUsers.length,
      latestLicense: tLicenses[0] || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Empresas (Tenants)</h2>
          <p className="text-sm text-slate-500 mt-1">
            {tenants.length} cadastrada(s)
          </p>
        </div>
        <CreateTenantDialog />
      </div>

      <TenantsTable
        tenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          createdAt: t.createdAt,
          userCount: meta.get(t.id)?.userCount ?? 0,
          latestLicense: meta.get(t.id)?.latestLicense
            ? {
                status: meta.get(t.id)!.latestLicense!.status,
                expiresAt: meta.get(t.id)!.latestLicense!.expiresAt,
              }
            : null,
        }))}
      />
    </div>
  );
}
