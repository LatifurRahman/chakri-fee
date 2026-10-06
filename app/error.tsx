"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="prose">
      <h1>তথ্য লোড করা যায়নি।</h1>
      <p>একটু পরে আবার চেষ্টা করুন।</p>
      <button className="button" onClick={reset}>
        আবার চেষ্টা করুন
      </button>
    </div>
  );
}
