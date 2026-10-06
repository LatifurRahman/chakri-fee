import Link from "next/link";
import { Brand } from "./header";
export const disclaimer =
  "এই ওয়েবসাইটের তথ্য ব্যবহারকারীদের বেনামী রিপোর্টের উপর ভিত্তি করে তৈরি। কোনো প্রতিষ্ঠানের অফিসিয়াল আবেদন ফি যাচাই করতে সংশ্লিষ্ট নিয়োগ বিজ্ঞপ্তি দেখুন।";
export function Footer() {
  return (
    <footer>
      <div className="disclaimer">
        <div className="wrap">
          <p>{disclaimer}</p>
        </div>
      </div>
      <div className="wrap footer">
        <div>
          <Brand />
          <p>একটি ছোট উদ্যোগ। একটি বড় হিসাব।</p>
        </div>
        <nav aria-label="ফুটার">
          <Link href="/about">সম্পর্কে</Link>
          <Link href="/methodology">পদ্ধতি</Link>
          <Link href="/privacy">গোপনীয়তা</Link>
        </nav>
      </div>
    </footer>
  );
}
