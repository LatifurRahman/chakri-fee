import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { AdminLogin, AdminPanel } from "@/components/admin";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "অ্যাডমিন",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await isAdmin())) return <AdminLogin />;
  const [reports, orgs] = await Promise.all([
    db()`SELECT id,organization_name,role_name,fee_amount,status,moderation_reason,created_at FROM fee_reports WHERE status IN ('pending','flagged') ORDER BY created_at DESC LIMIT 100`,
    db()`SELECT o.id,o.name,count(r.id)::int AS count FROM organizations o LEFT JOIN fee_reports r ON r.organization_id=o.id GROUP BY o.id ORDER BY o.name`,
  ]);
  return (
    <AdminPanel
      reports={
        reports as unknown as Parameters<typeof AdminPanel>[0]["reports"]
      }
      orgs={orgs as unknown as Parameters<typeof AdminPanel>[0]["orgs"]}
    />
  );
}
