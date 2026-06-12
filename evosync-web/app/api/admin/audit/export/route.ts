import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAudit } from "@/server/store/audit";

export const dynamic = "force-dynamic";

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * GET /api/admin/audit/export
 * Stream de CSV com todos os registros filtrados. Sem paginação.
 * Limite de segurança: 50.000 linhas.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const u = new URL(req.url);
  const result = listAudit({
    tenantId: u.searchParams.get("tenantId") || undefined,
    userId: u.searchParams.get("userId") || undefined,
    action: u.searchParams.get("action") || undefined,
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
    limit: 50_000,
  });

  const lines: string[] = [];
  lines.push("id,createdAt,action,tenantId,userId,details");
  for (const e of result.entries) {
    lines.push(
      [
        csvEscape(e.id),
        csvEscape(e.createdAt),
        csvEscape(e.action),
        csvEscape(e.tenantId),
        csvEscape(e.userId),
        csvEscape(e.details),
      ].join(",")
    );
  }
  const body = lines.join("\n");
  const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
