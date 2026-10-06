import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sameOrigin } from "@/lib/security";
import { db } from "@/lib/db";
import { normalizeOrganization, validateReport } from "@/lib/validation";
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAdmin()))
    return new NextResponse(null, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 2048) return new NextResponse(null, { status: 413 });
    const b = JSON.parse(text);
    if (typeof b.id !== "string" || !uuid.test(b.id))
      return new NextResponse(null, { status: 400 });
    if (b.action === "approve" || b.action === "reject") {
      await db().begin(async (sql) => {
        const r =
          await sql`UPDATE fee_reports SET status=${b.action === "approve" ? "approved" : "rejected"},moderation_reason=${b.action === "approve" ? "Reviewed by administrator" : "Rejected by administrator"} WHERE id=${b.id} RETURNING id`;
        if (!r.length) throw new Error("NOT_FOUND");
        await sql`INSERT INTO admin_audit(action,target_id) VALUES(${b.action},${b.id})`;
      });
    } else if (b.action === "rename") {
      const name = validateReport({
        organization_name: b.name,
        fee_amount: 0,
      }).organization_name;
      await db().begin(async (sql) => {
        const r =
          await sql`UPDATE organizations SET name=${name},normalized_name=${normalizeOrganization(name)} WHERE id=${b.id} RETURNING id`;
        if (!r.length) throw new Error("NOT_FOUND");
        await sql`INSERT INTO admin_audit(action,target_id) VALUES('rename',${b.id})`;
      });
    } else if (
      b.action === "merge" &&
      typeof b.target === "string" &&
      uuid.test(b.target) &&
      b.target !== b.id
    ) {
      await db().begin(async (sql) => {
        const records =
          await sql`SELECT id FROM organizations WHERE id IN (${b.id},${b.target}) ORDER BY id FOR UPDATE`;
        if (records.length !== 2) throw new Error("NOT_FOUND");
        await sql`UPDATE fee_reports SET organization_id=${b.target} WHERE organization_id=${b.id}`;
        await sql`DELETE FROM organizations WHERE id=${b.id}`;
        await sql`INSERT INTO admin_audit(action,target_id) VALUES('merge',${b.target})`;
      });
    } else return new NextResponse(null, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "পরিবর্তন করা যায়নি। নাম আগে থাকলে merge ব্যবহার করুন।" },
      { status: 400 },
    );
  }
}
