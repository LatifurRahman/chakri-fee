"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { money } from "@/lib/validation";
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}
type Result = {
  status: string;
  organization_name: string;
  role_name: string | null;
  fee_amount: number;
  slug: string;
};
export function ReportForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");
  const [role, setRole] = useState("");
  const [options, setOptions] = useState<{ name: string }[]>([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const success = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      if (!name.trim()) {
        setOptions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/organizations?q=${encodeURIComponent(name)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setOptions(Array.isArray(data) ? data : []);
      } catch {}
    }, 180);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [name]);
  useEffect(() => {
    if (!ready || !captcha.current || !window.turnstile || !siteKey || result)
      return;
    widget.current = window.turnstile.render(captcha.current, {
      sitekey: siteKey,
      action: "fee-report",
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        setError("নিরাপত্তা যাচাই লোড হয়নি। আবার চেষ্টা করুন।");
      },
    });
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [ready, siteKey, result]);
  useEffect(() => {
    if (result) success.current?.focus();
  }, [result]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    setField("");
    lock.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: name,
          fee_amount: fee,
          role_name: role,
          anti_spam_token: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "তথ্য জমা দেওয়া যায়নি। আবার চেষ্টা করুন।");
        setField(data.field || "");
        if (data.field) document.getElementById(data.field)?.focus();
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError("তথ্য জমা দেওয়া যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
      lock.current = false;
      setToken("");
      if (widget.current) window.turnstile?.reset(widget.current);
    }
  }
  return (
    <section className="form-panel" id="report" aria-labelledby="form-title">
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => setReady(true)}
        />
      )}
      {result ? (
        <div ref={success} tabIndex={-1} aria-live="polite">
          <div className="success-mark" aria-hidden="true">
            ✓
          </div>
          <h2>ধন্যবাদ!</h2>
          <p>
            {result.status === "approved"
              ? "আপনার তথ্য বেনামে হিসাবে যোগ হয়েছে।"
              : "আপনার রিপোর্ট বেনামে জমা হয়েছে। যাচাইয়ের পরে হিসাবে যোগ হবে।"}
          </p>
          <div className="receipt">
            <b>{result.organization_name}</b>
            {result.role_name && (
              <div className="muted">{result.role_name}</div>
            )}
            <strong>{money(result.fee_amount)}</strong>
          </div>
          <div className="success-actions">
            <button
              className="button"
              onClick={() => {
                setResult(null);
                setName("");
                setFee("");
                setRole("");
              }}
            >
              আরেকটি ফি যোগ করুন
            </button>
            <a href="#statistics" className="button outline">
              সামগ্রিক হিসাব দেখুন
            </a>
          </div>
        </div>
      ) : (
        <>
          <h2 id="form-title">আপনি কত টাকা দিয়েছেন?</h2>
          <p className="muted">
            আপনার একটি রিপোর্টেই হিসাবটা একটু পরিষ্কার হবে।
          </p>
          <form onSubmit={submit} noValidate aria-busy={busy}>
            {error && (
              <div id="form-error" className="error" role="alert">
                {error}
              </div>
            )}
            <div className="field">
              <label htmlFor="organization_name">
                প্রতিষ্ঠান / Organization *
              </label>
              <input
                id="organization_name"
                name="organization_name"
                required
                maxLength={160}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShow(true);
                }}
                onFocus={() => setShow(true)}
                autoComplete="off"
                placeholder="যেমন: বাংলাদেশ ব্যাংক"
                aria-invalid={field === "organization_name"}
                aria-describedby={
                  field === "organization_name" ? "form-error" : undefined
                }
              />
              {show && name.trim() && (
                <div
                  className="suggestions"
                  aria-label="প্রতিষ্ঠানের প্রস্তাবিত নাম"
                >
                  {options.map((o) => (
                    <button
                      type="button"
                      key={o.name}
                      onClick={() => {
                        setName(o.name);
                        setShow(false);
                      }}
                    >
                      {o.name}
                    </button>
                  ))}
                  {!options.some(
                    (o) => o.name.toLowerCase() === name.trim().toLowerCase(),
                  ) && (
                    <button type="button" onClick={() => setShow(false)}>
                      “{name.trim()}” নতুন প্রতিষ্ঠান হিসেবে যোগ করুন
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="fee_amount">আবেদন ফি *</label>
                <span className="currency" aria-hidden="true">
                  ৳
                </span>
                <input
                  className="fee"
                  id="fee_amount"
                  name="fee_amount"
                  inputMode="numeric"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="500"
                  aria-invalid={field === "fee_amount"}
                  aria-describedby={
                    field === "fee_amount" ? "form-error" : undefined
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="role_name">পদ / Position — ঐচ্ছিক</label>
                <input
                  id="role_name"
                  name="role_name"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  maxLength={120}
                  placeholder="যেমন: Officer"
                  aria-invalid={field === "role_name"}
                  aria-describedby={
                    field === "role_name" ? "form-error" : undefined
                  }
                />
              </div>
            </div>
            {siteKey && <div ref={captcha} />}
            <button className="button submit" type="submit" disabled={busy}>
              {busy ? "যোগ হচ্ছে..." : "হিসাবে যোগ করুন"}
            </button>
            <p className="privacy-note">নাম, ইমেইল বা অ্যাকাউন্ট লাগবে না।</p>
          </form>
        </>
      )}
    </section>
  );
}
