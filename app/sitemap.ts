import type { MetadataRoute } from "next";
import { db, configured } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.SITE_URL) return [];
  const orgs = configured()
    ? await db()`SELECT slug FROM organizations WHERE EXISTS(SELECT 1 FROM fee_reports WHERE organization_id=organizations.id AND status='approved') ORDER BY slug`
    : [];
  return [
    "",
    "/organizations",
    "/about",
    "/privacy",
    "/methodology",
    ...orgs.map((o) => `/organization/${o.slug}`),
  ].map((path) => ({ url: `${process.env.SITE_URL}${path}` }));
}
