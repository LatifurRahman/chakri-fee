import { readJson, HttpError } from "@/lib/http";
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
    const b = await readJson(request, 2048);
    const { id, action, target } = b;
    if (typeof id !== "string" || !uuid.test(id))
      return new NextResponse(null, { status: 400 });
    if (action === "approve" || action === "reject") {
      await db().begin(async (sql) => {
        const r =
          await sql`UPDATE fee_reports SET status=${action === "approve" ? "approved" : "rejected"},moderation_reason=${action === "approve" ? "Reviewed by administrator" : "Rejected by administrator"} WHERE id=${id} RETURNING id`;
        if (!r.length) throw new Error("NOT_FOUND");
        await sql`INSERT INTO admin_audit(action,target_id) VALUES(${action},${id})`;
      });
    } else if (action === "rename") {
      const name = validateReport({
        organization_name: b.name,
        fee_amount: 0,
      }).organization_name;
      await db().begin(async (sql) => {
        const r =
          await sql`UPDATE organizations SET name=${name},normalized_name=${normalizeOrganization(name)} WHERE id=${id} RETURNING id`;
        if (!r.length) throw new Error("NOT_FOUND");
        await sql`INSERT INTO admin_audit(action,target_id) VALUES('rename',${id})`;
      });
    } else if (
      action === "merge" &&
      typeof target === "string" &&
      uuid.test(target) &&
      target !== id
    ) {
      await db().begin(async (sql) => {
        const records =
          await sql`SELECT id FROM organizations WHERE id IN (${id},${target}) ORDER BY id FOR UPDATE`;
        if (records.length !== 2) throw new Error("NOT_FOUND");
        await sql`UPDATE fee_reports SET organization_id=${target} WHERE organization_id=${id}`;
        await sql`DELETE FROM organizations WHERE id=${id}`;
        await sql`INSERT INTO admin_audit(action,target_id) VALUES('merge',${target})`;
      });
    } else return new NextResponse(null, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "পরিবর্তন করা যায়নি। নাম আগে থাকলে merge ব্যবহার করুন।" },
      { status: 400 },
    );
  }
}
