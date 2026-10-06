import Link from "next/link";
export function Brand() {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="ফি দেই, কিন্তু চাকরি নাই — হোম"
    >
      <span className="mark" aria-hidden="true">
        ৳
      </span>
      <span>
        ফি দেই, কিন্তু চাকরি নাই
        <span className="brand-small block" lang="en">
          FEE DEI, KINTU CHAKRI NAI
        </span>
      </span>
    </Link>
  );
}
function Nav() {
  return (
    <>
      <Link href="/">হোম</Link>
      <Link href="/organizations">প্রতিষ্ঠান</Link>
      <Link href="/methodology">পদ্ধতি</Link>
      <Link href="/about">সম্পর্কে</Link>
      <Link href="/#report" className="button">
        ফি রিপোর্ট করুন
      </Link>
    </>
  );
}
export function Header() {
  return (
    <header className="topbar">
      <div className="wrap header">
        <Brand />
        <nav className="desktop-nav" aria-label="প্রধান নেভিগেশন">
          <Nav />
        </nav>
        <details className="mobile-menu">
          <summary aria-label="মেনু খুলুন">মেনু</summary>
          <nav aria-label="মোবাইল নেভিগেশন">
            <Nav />
          </nav>
        </details>
      </div>
    </header>
  );
}
