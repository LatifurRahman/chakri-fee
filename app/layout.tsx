import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
const title = "ফি দেই, কিন্তু চাকরি নাই";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: {
    default: `${title} | Bangladesh Job Application Fee Tracker`,
    template: `%s | ${title}`,
  },
  description:
    "বাংলাদেশে চাকরির আবেদন ফি নিয়ে বেনামী crowdsourced database। আপনি কত টাকা application fee দিয়েছেন রিপোর্ট করুন এবং সামগ্রিক হিসাব দেখুন।",
  openGraph: {
    title,
    description: "চাকরির আবেদন ফি-এর হিসাব রাখি।",
    locale: "bn_BD",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" data-scroll-behavior="smooth">
      <head>
        <link
          rel="preload"
          href="/fonts/bangla.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip" href="#main">
          মূল বিষয়বস্তুতে যান
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
