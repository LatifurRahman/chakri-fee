import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("fee_admin");
  return response;
}
