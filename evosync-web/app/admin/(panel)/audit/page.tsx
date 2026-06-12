import { listAudit, listAuditActions } from "@/server/store/audit";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import AuditTable from "./table";

export const dynamic = "force-dynamic";

export default function AdminAuditPage({
  searchParams,
}: {
  searchParams: { tenantId?: string; userId?: string; action?: string; from?: string; to?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const result = listAudit({
    tenantId: searchParams.tenantId,
    userId: searchParams.userId,
    action: searchParams.action,
    from: searchParams.from,
    to: searchParams.to,
    limit,
    offset,
  });
  const actions = listAuditActions();

  const db = getDb();
  const tenants = db
    .select({ id: schema.tenants.id, name: schema.tenants.name, slug: schema.tenants.slug })
    .from(schema.tenants)
    .all();
  const users = db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .all();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auditoria</h2>
          <p className="text-sm text-slate-500 mt-1">
            {result.total.toLocaleString("pt-BR")} registro(s) no total · Página {page} de{" "}
            {Math.max(1, Math.ceil(result.total / limit))}
          </p>
        </div>
        <a
          href={"/api/admin/audit/export" + buildQueryString(searchParams)}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ↓ Exportar CSV
        </a>
      </div>

      <AuditTable
        entries={result.entries}
        actions={actions}
        tenants={tenants}
        users={users}
        filters={searchParams}
        totalPages={Math.max(1, Math.ceil(result.total / limit))}
        currentPage={page}
      />
    </div>
  );
}

function buildQueryString(sp: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v) u.set(k, v);
  }
  u.delete("page");
  const s = u.toString();
  return s ? "?" + s : "";
}
