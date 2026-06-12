import { NextResponse } from "next/server";
import { sender } from "@/server/sender/manager";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

export async function POST() {
  sender.stop();
  hub.broadcast({
    type: "log",
    payload: {
      ts: new Date().toISOString(),
      line: "Parada solicitada pelo usuário",
      level: "warn",
    },
  });
  return NextResponse.json({ ok: true });
}
