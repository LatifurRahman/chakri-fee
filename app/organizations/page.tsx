import type { Metadata } from "next";
import { organizations } from "@/lib/db/queries";
import { OrgCard, Empty } from "@/components/data";
export const metadata: Metadata = {
  alternates: { canonical: "/organizations" },
  title: "প্রতিষ্ঠান",
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 160) : "";
  const sort = params.sort === "median" ? "median" : "count";
  const records = await organizations(q, sort);
  return (
    <div className="wrap">
      <div className="page-top">
        <span className="eyebrow">প্রতিষ্ঠানের হিসাবে</span>
        <h1>কোন প্রতিষ্ঠানের জন্য কত ফি রিপোর্ট হয়েছে?</h1>
        <p className="muted">
          ব্যবহারকারীদের রিপোর্ট করা ফি। অফিসিয়াল ফি নয়।
        </p>
        <form className="search-form" action="/organizations">
          <label className="hidden-label" htmlFor="directory-search">
            প্রতিষ্ঠান বা পদ খুঁজুন
          </label>
          <input
            className="search-input"
            name="q"
            id="directory-search"
            defaultValue={q}
            maxLength={160}
            placeholder="প্রতিষ্ঠান বা পদ খুঁজুন"
          />
          <label className="hidden-label" htmlFor="sort">
            সাজানোর পদ্ধতি
          </label>
          <select id="sort" name="sort" defaultValue={sort} className="!w-40">
            <option value="count">রিপোর্ট সংখ্যা</option>
            <option value="median">মিডিয়ান ফি</option>
          </select>
          <button className="button">খুঁজুন</button>
        </form>
      </div>
      {records.length ? (
        <div className="directory">
          {records.map((org) => (
            <OrgCard org={org} key={org.id} />
          ))}
        </div>
      ) : (
        <div className="py-8">
          <Empty>
            {q
              ? "এই নামে কোনো প্রতিষ্ঠান পাওয়া যায়নি।"
              : "এখনও কোনো প্রতিষ্ঠান পাওয়া যায়নি।"}
          </Empty>
        </div>
      )}
    </div>
  );
}
