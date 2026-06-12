import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import LicensesTable from "./table";
import { Card, CardContent } from "@/components/ui/card";

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Licenças</h2>
        <p className="text-sm text-slate-500 mt-1">
          Cada tenant precisa de pelo menos uma licença ativa. Licenças
          expiram em 30 dias por padrão; renove para estender.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
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
        </CardContent>
      </Card>
    </div>
  );
}
