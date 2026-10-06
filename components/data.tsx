import Link from "next/link";
import type { Organization, PublicReport, Stats } from "@/lib/db/queries";
import { bn, money } from "@/lib/validation";
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        ৳
      </div>
      <p>{children}</p>
    </div>
  );
}
export function StatsBand({ stats }: { stats: Stats }) {
  return (
    <section
      className="stats-band"
      id="statistics"
      aria-labelledby="stats-heading"
    >
      <div className="wrap">
        <div className="section-head">
          <h2 id="stats-heading">এখন পর্যন্ত হিসাব</h2>
          <span className="badge">বেনামী রিপোর্টের ভিত্তিতে</span>
        </div>
        <div className="stats-grid">
          {[
            [money(stats.total), "মোট রিপোর্ট করা আবেদন ফি"],
            [bn(stats.count), "মোট রিপোর্ট"],
            [money(stats.median), "মিডিয়ান আবেদন ফি"],
            [money(stats.mean), "গড় আবেদন ফি"],
            [bn(stats.organizations), "মোট প্রতিষ্ঠান"],
          ].map(([value, label]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="stat-note">
          {stats.count
            ? `${bn(stats.count)}টি অনুমোদিত রিপোর্টের ভিত্তিতে। মোট টাকা শুধু জমা দেওয়া রিপোর্টগুলোর যোগফল।`
            : "এখনও পর্যাপ্ত তথ্য নেই। প্রথম রিপোর্টটি আপনি দিন।"}
        </p>
      </div>
    </section>
  );
}
export function ReportList({ reports }: { reports: PublicReport[] }) {
  if (!reports.length)
    return <Empty>এখনও কোনো রিপোর্ট নেই। প্রথম রিপোর্টটি আপনি দিন।</Empty>;
  return (
    <div className="list">
      {reports.map((r, i) => (
        <article className="report-row" key={`${r.slug}-${r.created_at}-${i}`}>
          <div>
            <h3>
              <Link href={`/organization/${r.slug}`}>{r.name}</Link>
            </h3>
            <p>
              {r.role_name || "পদ উল্লেখ করা হয়নি"} ·{" "}
              {new Intl.DateTimeFormat("bn-BD", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Dhaka",
              }).format(new Date(r.created_at))}
            </p>
          </div>
          <strong>{money(r.fee_amount)}</strong>
        </article>
      ))}
    </div>
  );
}
export function OrgCard({ org }: { org: Organization }) {
  return (
    <Link className="org-card" href={`/organization/${org.slug}`}>
      <h3>{org.name}</h3>
      <p className="sample">
        {bn(org.count)}টি বেনামী রিপোর্ট{org.count < 5 ? " · সীমিত তথ্য" : ""}
      </p>
      <div className="metrics">
        <div>
          <strong>{money(org.median)}</strong>
          <span>মিডিয়ান রিপোর্ট করা ফি</span>
        </div>
        <div>
          <strong>{money(org.mean)}</strong>
          <span>গড় রিপোর্ট করা ফি</span>
        </div>
      </div>
      <div className="text-link mt-4 text-sm">বিস্তারিত দেখুন</div>
    </Link>
  );
}
