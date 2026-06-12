import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import UsersTable from "./table";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  const db = getDb();
  const users = db
    .select()
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .all();
  const tenants = db.select().from(schema.tenants).all();
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usuários</h2>
        <p className="text-sm text-slate-500 mt-1">
          Todos os usuários cadastrados na plataforma. Super admins
          não pertencem a nenhum tenant.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <UsersTable
            users={users.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role,
              status: u.status,
              createdAt: u.createdAt,
              tenantId: u.tenantId,
              tenantName: u.tenantId ? tenantById.get(u.tenantId)?.name || null : null,
              tenantSlug: u.tenantId ? tenantById.get(u.tenantId)?.slug || null : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
