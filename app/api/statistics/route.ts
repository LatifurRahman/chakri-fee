import { NextResponse } from "next/server";
import { getStats } from "@/lib/db/queries";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch {
    return NextResponse.json({ error: "তথ্য পাওয়া যায়নি।" }, { status: 503 });
  }
}
