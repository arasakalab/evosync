import { NextResponse } from "next/server";
import { sender } from "@/server/sender/manager";
import { hub } from "@/server/ws/hub";

export const dynamic = "force-dynamic";

export async function POST() {
  sender.pause();
  hub.broadcast({
    type: "log",
    payload: { ts: new Date().toISOString(), line: "Pausado pelo usuário", level: "info" },
  });
  return NextResponse.json({ ok: true });
}
