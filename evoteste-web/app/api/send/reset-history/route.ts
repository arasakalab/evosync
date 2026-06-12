import { NextResponse } from "next/server";
import { resetSentLog } from "@/server/store/sent-log";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

export async function POST() {
  const removed = resetSentLog();
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: `Histórico de envios resetado (${removed} número(s) removido(s))`,
      level: "warn",
    },
  });
  return NextResponse.json({ removed });
}
