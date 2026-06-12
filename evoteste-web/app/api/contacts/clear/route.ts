import { NextRequest, NextResponse } from "next/server";
import { loadContacts, saveContacts } from "@/server/store/contacts";

export const dynamic = "force-dynamic";

export async function POST() {
  const current = loadContacts();
  saveContacts([]);
  return NextResponse.json({ ok: true, removed: current.length });
}
