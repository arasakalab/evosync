import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { isSchedulerLoopRunning } from "@/server/scheduler/loop";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Liveness check. Retorna 200 com { status, db, scheduler, uptime }
 * se tudo OK; 503 se DB inacessível.
 *
 * Usado por:
 *  - systemd watchdog (Restart=always)
 *  - nginx health check (opcional)
 *  - monitoring externo (UptimeRobot etc)
 */
export async function GET() {
  const uptime = Math.floor(process.uptime());
  let dbOk = false;
  try {
    const db = getDb();
    // query trivial que força I/O no SQLite
    const r = db
      .select({ id: schema.tenants.id })
      .from(schema.tenants)
      .limit(1)
      .all();
    dbOk = r.length >= 0;
  } catch {
    dbOk = false;
  }
  let schedOk = false;
  try {
    schedOk = isSchedulerLoopRunning();
  } catch {
    schedOk = false;
  }
  const allOk = dbOk && schedOk;
  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      db: dbOk,
      scheduler: schedOk,
      uptime,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
