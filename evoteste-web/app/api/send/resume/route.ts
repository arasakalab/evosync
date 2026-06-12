import { NextResponse } from "next/server";
import { sender } from "@/server/sender/manager";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

export async function POST() {
  sender.resume();
  hub.broadcast({
    type: "log",
    payload: { ts: new Date().toISOString(), line: "Retomado pelo usuário", level: "info" },
  });
  return NextResponse.json({ ok: true });
}
