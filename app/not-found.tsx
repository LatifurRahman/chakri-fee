import Link from "next/link";
export default function NotFound() {
  return (
    <div className="prose">
      <h1>পাতাটি পাওয়া যায়নি।</h1>
      <p>এই প্রতিষ্ঠানের অনুমোদিত রিপোর্ট এখনও নাও থাকতে পারে।</p>
      <Link className="button" href="/organizations">
        প্রতিষ্ঠান দেখুন
      </Link>
    </div>
  );
}
