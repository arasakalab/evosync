import { NextResponse } from "next/server";
import { loadSchedules, saveSchedules } from "@/server/store/schedules";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const all = loadSchedules();
  saveSchedules([]);
  return NextResponse.json({ removed: all.length });
}
