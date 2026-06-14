import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import UsersTable from "./table";
import { PageHeader } from "@/components/admin/page-header";
import { Users } from "lucide-react";

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
      <PageHeader
        title="Usuários"
        description="Todos os usuários cadastrados na plataforma. Super admins não pertencem a nenhum tenant."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuários" },
        ]}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-subtle border border-info/20 px-2.5 py-0.5 text-2xs font-medium text-info-foreground">
            <Users className="h-3 w-3" />
            {users.length} cadastrado(s)
          </span>
        }
      />

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
    </div>
  );
}
