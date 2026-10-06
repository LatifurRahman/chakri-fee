import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "./index";
import {
  normalizeOrganization,
  positiveConfig,
  type ReportInput,
} from "../validation";
import { digest } from "../security";
export async function submitReport(input: ReportInput, source: string) {
  const normalized = normalizeOrganization(input.organization_name);
  const pattern = digest(
    `${source}:${normalized}:${input.role_name?.toLowerCase() ?? ""}:${input.fee_amount}`,
  );
  return db().begin(async (sql) => {
    await sql`DELETE FROM submission_patterns WHERE expires_at<now()`;
    const inserted =
      await sql`INSERT INTO submission_patterns(key,expires_at) VALUES(${pattern},now()+interval '2 minutes') ON CONFLICT(key) DO NOTHING RETURNING key`;
    const suspicious = !inserted.length;
    const status =
      input.fee_amount > positiveConfig(process.env.NORMAL_FEE_MAX, 10000) ||
      suspicious
        ? "flagged"
        : "approved";
    const base =
      normalized
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || "organization";
    const slug = `${base}-${createHash("sha256").update(normalized).digest("hex").slice(0, 10)}`;
    const [org] =
      await sql`INSERT INTO organizations(id,name,normalized_name,slug) VALUES(${randomUUID()},${input.organization_name},${normalized},${slug}) ON CONFLICT(normalized_name) DO UPDATE SET normalized_name=excluded.normalized_name RETURNING id,name,slug`;
    await sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,role_name,fee_amount,status,moderation_reason) VALUES(${org.id},${input.organization_name},${normalized},${input.role_name},${input.fee_amount},${status},${status === "flagged" ? (suspicious ? "Repeated technical pattern" : "Above normal fee threshold") : null})`;
    return {
      status,
      organization_name: org.name,
      role_name: input.role_name,
      fee_amount: input.fee_amount,
      slug: org.slug,
    };
  });
}
