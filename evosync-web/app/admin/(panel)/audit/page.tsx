import { listAudit, listAuditActions } from "@/server/store/audit";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import AuditTable from "./table";
import { PageHeader } from "@/components/admin/page-header";
import { ScrollText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      <PageHeader
        title="Auditoria"
        description={`${result.total.toLocaleString("pt-BR")} registro(s) · Página ${page} de ${Math.max(1, Math.ceil(result.total / limit))}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Auditoria" },
        ]}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-subtle border border-info/20 px-2.5 py-0.5 text-2xs font-medium text-info-foreground">
            <ScrollText className="h-3 w-3" />
            log de ações
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={"/api/admin/audit/export" + buildQueryString(searchParams)}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Link>
          </Button>
        }
      />

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
