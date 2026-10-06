import { readJson, HttpError } from "@/lib/http";
import { NextResponse } from "next/server";
import { validateReport, ValidationError } from "@/lib/validation";
import { configured } from "@/lib/db";
import { submitReport } from "@/lib/db/submit";
import {
  sameOrigin,
  anonymousSource,
  rateLimit,
  verifyTurnstile,
} from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "অনুরোধটি গ্রহণ করা যায়নি।" },
      { status: 403 },
    );
  if (!configured())
    return NextResponse.json(
      { error: "তথ্যভান্ডার এখন সংযুক্ত নয়। পরে আবার চেষ্টা করুন।" },
      { status: 503 },
    );
  try {
    const body = await readJson(request, 8192);
    const input = validateReport(body);
    const source = anonymousSource(request);
    if (!(await rateLimit(`report:${source}`)))
      return NextResponse.json(
        { error: "অল্প সময়ে অনেক রিপোর্ট হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন।" },
        { status: 429, headers: { "Retry-After": "600" } },
      );
    if (!(await verifyTurnstile(body.anti_spam_token)))
      return NextResponse.json(
        { error: "নিরাপত্তা যাচাই সম্পন্ন করুন।" },
        { status: 400 },
      );
    const result = await submitReport(input, source);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof ValidationError)
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 422 },
      );
    console.error("Report submission failed", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "তথ্য জমা দেওয়া যায়নি। আবার চেষ্টা করুন।" },
      { status: 503 },
    );
  }
}
