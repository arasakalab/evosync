import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAudit, listAuditActions } from "@/server/store/audit";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit
 * Query: ?tenantId=&userId=&action=&from=&to=&limit=&offset=
 * Super admin only. Retorna { entries, total, actions } (actions só na 1ª página).
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
  const includeActions = u.searchParams.get("includeActions") === "1";
  const result = listAudit({
    tenantId: u.searchParams.get("tenantId") || undefined,
    userId: u.searchParams.get("userId") || undefined,
    action: u.searchParams.get("action") || undefined,
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
    limit: u.searchParams.get("limit")
      ? Number(u.searchParams.get("limit"))
      : undefined,
    offset: u.searchParams.get("offset")
      ? Number(u.searchParams.get("offset"))
      : undefined,
  });
  return NextResponse.json({
    entries: result.entries,
    total: result.total,
    actions: includeActions ? listAuditActions() : undefined,
  });
}
