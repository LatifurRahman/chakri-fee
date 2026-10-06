"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, bn } from "@/lib/validation";
type RecordRow = {
  id: string;
  organization_name: string;
  role_name: string | null;
  fee_amount: number;
  status: string;
  moderation_reason: string | null;
  created_at: string;
};
type Org = { id: string; name: string; count: number };
export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassword("");
        router.refresh();
      } else setMessage(data.error);
    } catch {
      setMessage("প্রবেশ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="prose">
      <h1>অ্যাডমিন প্রবেশ</h1>
      <p>শুধু অনুমোদিত প্রশাসকের জন্য।</p>
      <form onSubmit={login} className="form-panel">
        <label htmlFor="admin-password">পাসওয়ার্ড</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="button mt-4" disabled={busy}>
          {busy ? "প্রবেশ হচ্ছে..." : "প্রবেশ করুন"}
        </button>
        <p role="alert" className="mt-3">
          {message}
        </p>
      </form>
    </div>
  );
}
export function AdminPanel({
  reports,
  orgs,
}: {
  reports: RecordRow[];
  orgs: Org[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(body: Record<string, string>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("পরিবর্তন সংরক্ষিত।");
        router.refresh();
      } else setMessage(data.error);
    } catch {
      setMessage("পরিবর্তন করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wrap admin">
      <div className="section-head">
        <h1 className="!text-3xl !m-0">রিপোর্ট পর্যালোচনা</h1>
        <button
          className="button outline"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            router.refresh();
          }}
        >
          লগ আউট
        </button>
      </div>
      <p className="muted">
        একই প্রযুক্তিগত pattern ও অস্বাভাবিক ফি কারণ হিসেবে দেখা যায়। কাঁচা IP
        বা অবদানকারীর পরিচয় সংরক্ষণ করা হয় না।
      </p>
      <p role="status">{message}</p>
      <div className="table-wrap">
        <table>
          <caption className="text-left mb-3">
            সর্বশেষ ১০০টি pending / flagged রিপোর্ট
          </caption>
          <thead>
            <tr>
              <th>প্রতিষ্ঠান / পদ</th>
              <th>ফি</th>
              <th>অবস্থা / কারণ</th>
              <th>পর্যালোচনা</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.organization_name}
                  <div className="sample">
                    {r.role_name || "—"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("bn-BD")}
                  </div>
                </td>
                <td>{money(r.fee_amount)}</td>
                <td>
                  {r.status}
                  <div className="sample">{r.moderation_reason}</div>
                </td>
                <td>
                  <button
                    disabled={busy}
                    className="button"
                    onClick={() => action({ action: "approve", id: r.id })}
                  >
                    অনুমোদন
                  </button>
                  <button
                    disabled={busy}
                    className="button outline"
                    onClick={() => action({ action: "reject", id: r.id })}
                  >
                    প্রত্যাখ্যান
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!reports.length && (
          <p className="p-5">পর্যালোচনার জন্য কোনো রিপোর্ট নেই।</p>
        )}
      </div>
      <h2 className="mt-10">প্রতিষ্ঠান সংশোধন ও merge</h2>
      <p className="muted">
        Merge করলে সব রিপোর্ট নির্বাচিত প্রতিষ্ঠানে যাবে। মূল জমা দেওয়া নাম
        রিপোর্টে সংরক্ষিত থাকবে। ফি পরিবর্তন করা হয় না।
      </p>
      {orgs.map((o) => (
        <div className="org-card" key={o.id}>
          <h3>
            {o.name} <span className="sample">({bn(o.count)} রিপোর্ট)</span>
          </h3>
          <form
            className="flex flex-wrap gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void action({
                action: "rename",
                id: o.id,
                name: String(data.get("name")),
              });
            }}
          >
            <label className="hidden-label" htmlFor={`name-${o.id}`}>
              নাম সংশোধন
            </label>
            <input
              id={`name-${o.id}`}
              name="name"
              defaultValue={o.name}
              required
              maxLength={160}
            />
            <button className="button outline" disabled={busy}>
              নাম সংরক্ষণ
            </button>
          </form>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const target = String(
                new FormData(e.currentTarget).get("target"),
              );
              if (
                confirm("সব রিপোর্ট নির্বাচিত প্রতিষ্ঠানে স্থানান্তর করতে চান?")
              )
                void action({ action: "merge", id: o.id, target });
            }}
          >
            <label className="hidden-label" htmlFor={`merge-${o.id}`}>
              Canonical প্রতিষ্ঠান
            </label>
            <select
              className="!w-auto max-w-full"
              id={`merge-${o.id}`}
              name="target"
              required
              defaultValue=""
            >
              <option disabled value="">
                Canonical প্রতিষ্ঠান নির্বাচন করুন
              </option>
              {orgs
                .filter((x) => x.id !== o.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
            <button className="button outline" disabled={busy}>
              Merge করুন
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
