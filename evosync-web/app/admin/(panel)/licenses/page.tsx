import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import LicensesTable from "./table";
import { PageHeader } from "@/components/admin/page-header";
import { KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminLicensesPage() {
  const db = getDb();
  const licenses = db
    .select()
    .from(schema.licenses)
    .orderBy(desc(schema.licenses.issuedAt))
    .all();
  const tenants = db.select().from(schema.tenants).all();
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licenças"
        description="Cada tenant precisa de pelo menos uma licença ativa. Renove para estender a validade."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Licenças" },
        ]}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle border border-primary/20 px-2.5 py-0.5 text-2xs font-medium text-primary">
            <KeyRound className="h-3 w-3" />
            {licenses.length} emitida(s)
          </span>
        }
      />

      <LicensesTable
        licenses={licenses.map((l) => ({
          id: l.id,
          tenantId: l.tenantId,
          tenantName: tenantById.get(l.tenantId)?.name || "(removido)",
          tenantSlug: tenantById.get(l.tenantId)?.slug || "—",
          status: l.status,
          issuedAt: l.issuedAt,
          expiresAt: l.expiresAt,
          notes: l.notes,
        }))}
      />
    </div>
  );
}
