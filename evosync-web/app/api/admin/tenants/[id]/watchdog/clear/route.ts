/**
 * POST /api/admin/tenants/[id]/watchdog/clear
 *
 * Libera a pausa do watchdog anti-ban para um tenant específico.
 * Requer super_admin.
 *
 * Body: { note?: string } (opcional, vai pro audit log)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTenant } from "@/server/store/tenants";
import { clearWatchdogPause } from "@/server/store/watchdog";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }
  const tenant = getTenant(params.id);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }
  if (!tenant.pausedByWatchdog) {
    return NextResponse.json(
      { ok: true, wasPaused: false, message: "Tenant não está pausado" },
      { status: 200 }
    );
  }

  let note: string | undefined;
  try {
    const body = await req.json();
    note = typeof body?.note === "string" ? body.note.slice(0, 500) : undefined;
  } catch {
    /* body vazio OK */
  }

  const r = clearWatchdogPause(params.id, session.user.id, note);
  return NextResponse.json({
    ok: r.cleared,
    wasPaused: r.wasPaused,
    message: r.cleared
      ? "Pausa do watchdog liberada. Tenant pode enviar novamente."
      : "Nenhuma mudança (tenant não estava pausado)",
  });
}
