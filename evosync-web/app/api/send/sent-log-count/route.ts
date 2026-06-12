import { NextResponse } from "next/server";
import { sentLogCount } from "@/server/store/sent-log";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ count: sentLogCount() });
}
