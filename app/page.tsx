export const metadata = { alternates: { canonical: "/" } };
import Link from "next/link";
import { getStats, recentReports, organizations } from "@/lib/db/queries";
import { ReportForm } from "@/components/report-form";
import { Empty, OrgCard, ReportList, StatsBand } from "@/components/data";
import { Share } from "@/components/share";
import { positiveConfig, bn } from "@/lib/validation";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [s, r, o, m] = await Promise.allSettled([
    getStats(),
    recentReports(),
    organizations(),
    organizations("", "median"),
  ]);
  const stats =
    s.status === "fulfilled"
      ? s.value
      : { count: 0, total: 0, mean: 0, median: 0, organizations: 0 };
  const failed = [s, r, o, m].some((x) => x.status === "rejected");
  return (
    <>
      <div className="wrap intro-grid">
        <section className="hero">
          <span className="eyebrow">আপনার ফি। আমাদের সবার হিসাব।</span>
          <h1>
            চাকরির আবেদন করতে
            <br />
            কত টাকা <em>ফি দিচ্ছেন?</em>
            <br />
            চলুন হিসাব রাখি।
          </h1>
          <p>
            বাংলাদেশে চাকরির আবেদন ফি নিয়ে একটি উন্মুক্ত, বেনামী ও জনসাধারণের
            তথ্যভান্ডার।
          </p>
          <a href="#report" className="button">
            আপনার ফি রিপোর্ট করুন
          </a>
          <div className="mini-notes">
            <span>✓ সম্পূর্ণ বেনামী</span>
            <span>✓ কোনো অ্যাকাউন্ট নয়</span>
            <span>✓ সবার জন্য উন্মুক্ত</span>
          </div>
        </section>
        <ReportForm />
      </div>
      {failed ? (
        <div className="wrap status-message" role="status">
          এই মুহূর্তে হিসাব লোড করা যায়নি। পরে আবার চেষ্টা করুন।
        </div>
      ) : (
        <StatsBand stats={stats} />
      )}
      <div className="wrap">
        <section className="section data-grid">
          <div>
            <div className="section-head">
              <h2>সাম্প্রতিক রিপোর্ট</h2>
              <span className="sample">অনুমোদিত তথ্য</span>
            </div>
            {r.status === "fulfilled" ? (
              <ReportList reports={r.value.slice(0, 5)} />
            ) : (
              <Empty>রিপোর্ট লোড করা যায়নি।</Empty>
            )}
          </div>
          <div>
            <div className="section-head">
              <h2>সবচেয়ে বেশি রিপোর্ট</h2>
              <Link href="/organizations">সব প্রতিষ্ঠান</Link>
            </div>
            <div className="org-stack">
              {o.status === "fulfilled" && o.value.length ? (
                o.value
                  .slice(0, 3)
                  .map((org) => <OrgCard key={org.id} org={org} />)
              ) : (
                <Empty>এখনও কোনো প্রতিষ্ঠান পাওয়া যায়নি।</Empty>
              )}
            </div>
          </div>
        </section>
        <section className="section">
          <div className="search-block">
            <div>
              <h2>কোন প্রতিষ্ঠান কত ফি নিচ্ছে?</h2>
              <p>প্রতিষ্ঠান বা পদের নামে রিপোর্ট খুঁজুন।</p>
            </div>
            <form className="search-form" action="/organizations">
              <label className="hidden-label" htmlFor="home-search">
                প্রতিষ্ঠান বা পদ খুঁজুন
              </label>
              <input
                className="search-input"
                id="home-search"
                name="q"
                placeholder="প্রতিষ্ঠান খুঁজুন"
                maxLength={160}
              />
              <button className="button" type="submit">
                খুঁজুন
              </button>
            </form>
          </div>
        </section>
        <section className="section">
          <div className="section-head">
            <h2>সর্বোচ্চ মিডিয়ান রিপোর্ট করা ফি</h2>
            <span className="sample">
              অন্তত {bn(positiveConfig(process.env.LEADERBOARD_MIN_REPORTS, 5))}
              টি রিপোর্ট
            </span>
          </div>
          <div className="directory !my-0">
            {m.status === "fulfilled" && m.value.length ? (
              m.value
                .slice(0, 3)
                .map((org) => <OrgCard org={org} key={org.id} />)
            ) : (
              <div className="col-span-full">
                <Empty>র‍্যাঙ্কিংয়ের জন্য এখনও পর্যাপ্ত রিপোর্ট নেই।</Empty>
              </div>
            )}
          </div>
        </section>
        <section className="story">
          <div>
            <span className="number">০১ / কেন এই উদ্যোগ</span>
            <h2>
              ছোট ছোট ফি।
              <br />
              সব মিলিয়ে কত?
            </h2>
            <p>
              একটি আবেদন, আরেকটি আবেদন। প্রতিবারই কিছু টাকা। চাকরি খোঁজার এই
              খরচের সহজলভ্য হিসাব খুব কম। আপনার রিপোর্ট সেই খরচটা দৃশ্যমান করতে
              সাহায্য করবে।
            </p>
            <Link className="text-link" href="/about">
              আমাদের কথা
            </Link>
          </div>
          <div>
            <span className="number">০২ / তথ্যকে বুঝে ব্যবহার করুন</span>
            <h2>
              রিপোর্ট করা ফি,
              <br />
              অফিসিয়াল মূল্যতালিকা নয়।
            </h2>
            <p>
              এখানে প্রতিটি সংখ্যা ব্যবহারকারীদের জমা দেওয়া তথ্য থেকে আসে।
              গড়ের পাশাপাশি মিডিয়ান ও রিপোর্টের সংখ্যা দেখুন। কোনো
              প্রতিষ্ঠানের বর্তমান ফি জানতে নিয়োগ বিজ্ঞপ্তি দেখুন।
            </p>
            <Link className="text-link" href="/methodology">
              হিসাবের পদ্ধতি জানুন
            </Link>
          </div>
        </section>
        <div className="pb-10">
          <Share />
        </div>
      </div>
    </>
  );
}
