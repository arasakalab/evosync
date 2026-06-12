import { NextResponse } from "next/server";
import { sender } from "@/server/sender/manager";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(sender.getStatus());
}
