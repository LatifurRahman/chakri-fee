import { NextResponse } from "next/server";
import { autocomplete } from "@/lib/db/queries";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length > 160) return NextResponse.json([]);
  try {
    return NextResponse.json(await autocomplete(q));
  } catch {
    return NextResponse.json(
      { error: "অনুসন্ধান করা যায়নি।" },
      { status: 503 },
    );
  }
}
