import Link from "next/link";
import { notFound } from "next/navigation";
import { organization, recentReports } from "@/lib/db/queries";
import { ReportList } from "@/components/data";
import { bn, money } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await organization(slug);
  return {
    alternates: { canonical: `/organization/${encodeURIComponent(slug)}` },
    title: org ? `${org.name} — রিপোর্ট করা ফি` : "প্রতিষ্ঠান পাওয়া যায়নি",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await organization(slug);
  if (!org) notFound();
  const reports = await recentReports(slug);
  return (
    <div className="wrap">
      <div className="page-top">
        <div className="breadcrumb">
          <Link href="/organizations">প্রতিষ্ঠান</Link> / রিপোর্ট করা ফি
        </div>
        <h1>{org.name}</h1>
        <p className="sample">
          {bn(org.count)}টি অনুমোদিত বেনামী রিপোর্টের ভিত্তিতে
          {org.count < 5 ? " · সীমিত তথ্য" : ""}
        </p>
      </div>
      <div className="detail-stats">
        {[
          [money(org.median), "মিডিয়ান রিপোর্ট করা ফি"],
          [money(org.mean), "গড় রিপোর্ট করা ফি"],
          [money(org.minimum), "সর্বনিম্ন রিপোর্ট করা ফি"],
          [money(org.maximum), "সর্বোচ্চ রিপোর্ট করা ফি"],
          [bn(org.count), "মোট রিপোর্ট"],
        ].map(([v, l]) => (
          <div className="org-card" key={l}>
            <strong>{v}</strong>
            <span className="sample">{l}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        এই প্রতিষ্ঠানের জন্য জমা দেওয়া রিপোর্টে মোট {money(org.total)} আবেদন ফি
        উল্লেখ করা হয়েছে। এটি সব আবেদনকারীর খরচের হিসাব নয়।
      </p>
      <section className="section">
        <div className="section-head">
          <h2>সাম্প্রতিক রিপোর্ট করা ফি</h2>
          <Link href="/#report">ফি যোগ করুন</Link>
        </div>
        <ReportList reports={reports} />
      </section>
    </div>
  );
}
