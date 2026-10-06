import { readJson, HttpError } from "@/lib/http";
import { NextResponse } from "next/server";
import {
  sameOrigin,
  anonymousSource,
  rateLimit,
  validPassword,
  createSession,
} from "@/lib/security";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const source = anonymousSource(request);
    if (!(await rateLimit(`admin:${source}`, 5, 900)))
      return NextResponse.json(
        { error: "কিছুক্ষণ পরে চেষ্টা করুন।" },
        { status: 429 },
      );
    const { password } = await readJson(request, 1024);
    if (typeof password !== "string" || !validPassword(password))
      return NextResponse.json(
        { error: "পাসওয়ার্ড সঠিক নয়।" },
        { status: 401 },
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set("fee_admin", createSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "অ্যাডমিন প্রবেশ এখন চালু নেই।" },
      { status: 503 },
    );
  }
}
