import { NextRequest, NextResponse } from "next/server";
import type { Contact } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const template = String(body.template || "");
  const contact: Contact = body.contact || { number: "", fields: {} };
  let rendered = template;
  for (const [k, v] of Object.entries(contact.fields || {})) {
    rendered = rendered.replaceAll("{" + k + "}", String(v));
  }
  return NextResponse.json({ rendered });
}
