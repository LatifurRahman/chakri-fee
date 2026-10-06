import "server-only";
import { db, configured } from "./index";
import { normalizeOrganization, positiveConfig } from "../validation";
export type Stats = {
  count: number;
  total: number;
  mean: number;
  median: number;
  organizations: number;
};
export type Organization = {
  id: string;
  name: string;
  slug: string;
  count: number;
  mean: number;
  median: number;
  minimum: number;
  maximum: number;
  total: number;
};
export type PublicReport = {
  name: string;
  slug: string;
  role_name: string | null;
  fee_amount: number;
  created_at: string;
};
const zero: Stats = {
  count: 0,
  total: 0,
  mean: 0,
  median: 0,
  organizations: 0,
};
export async function getStats(): Promise<Stats> {
  if (!configured()) return zero;
  const [s] = await db()<
    Stats[]
  >`SELECT count(*)::int AS count, coalesce(sum(fee_amount),0)::float8 AS total, coalesce(avg(fee_amount),0)::float8 AS mean, coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY fee_amount),0)::float8 AS median, count(DISTINCT organization_id)::int AS organizations FROM fee_reports WHERE status='approved'`;
  return s;
}
export async function recentReports(slug?: string): Promise<PublicReport[]> {
  if (!configured()) return [];
  return db()<
    PublicReport[]
  >`SELECT o.name,o.slug,r.role_name,r.fee_amount,r.created_at FROM fee_reports r JOIN organizations o ON o.id=r.organization_id WHERE r.status='approved' AND (${slug ?? null}::text IS NULL OR o.slug=${slug ?? null}) ORDER BY r.created_at DESC LIMIT 12`;
}
export async function organizations(
  query = "",
  sort = "count",
): Promise<Organization[]> {
  if (!configured()) return [];
  const q = normalizeOrganization(query).replace(/[\%_]/g, "\\$&");
  return db()<
    Organization[]
  >`SELECT o.id,o.name,o.slug,count(r.id)::int AS count,coalesce(avg(r.fee_amount),0)::float8 AS mean,coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY r.fee_amount),0)::float8 AS median,min(r.fee_amount)::int AS minimum,max(r.fee_amount)::int AS maximum,sum(r.fee_amount)::float8 AS total FROM organizations o JOIN fee_reports r ON r.organization_id=o.id AND r.status='approved' WHERE o.normalized_name LIKE ${"%" + q + "%"} OR EXISTS(SELECT 1 FROM fee_reports rr WHERE rr.organization_id=o.id AND rr.status='approved' AND lower(rr.role_name) LIKE ${"%" + q + "%"}) GROUP BY o.id HAVING (${sort} <> 'median' OR count(r.id)>=${positiveConfig(process.env.LEADERBOARD_MIN_REPORTS, 5)}) ORDER BY CASE WHEN ${sort}='median' THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY r.fee_amount) ELSE count(r.id) END DESC,o.name LIMIT 100`;
}
export async function organization(
  slug: string,
): Promise<Organization | undefined> {
  if (!configured()) return;
  const [o] = await db()<
    Organization[]
  >`SELECT o.id,o.name,o.slug,count(r.id)::int AS count,coalesce(avg(r.fee_amount),0)::float8 AS mean,coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY r.fee_amount),0)::float8 AS median,coalesce(min(r.fee_amount),0)::int AS minimum,coalesce(max(r.fee_amount),0)::int AS maximum,coalesce(sum(r.fee_amount),0)::float8 AS total FROM organizations o JOIN fee_reports r ON r.organization_id=o.id AND r.status='approved' WHERE o.slug=${slug} GROUP BY o.id`;
  return o;
}
export async function autocomplete(query: string) {
  if (!configured() || !query.trim()) return [];
  const q = normalizeOrganization(query).replace(/[\%_]/g, "\\$&");
  return db()`SELECT name FROM organizations WHERE normalized_name LIKE ${q + "%"} AND EXISTS(SELECT 1 FROM fee_reports WHERE organization_id=organizations.id AND status='approved') ORDER BY name LIMIT 6`;
}
