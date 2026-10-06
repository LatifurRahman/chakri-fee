// Regenerate with: CHROMIUM_PATH=/usr/bin/chromium node scripts/social-card.mjs
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const font = (await readFile("public/fonts/bangla.ttf")).toString("base64");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>@font-face{font-family:Bangla;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#075e48;color:white;font-family:Bangla;width:1200px;height:630px;display:flex;align-items:center;padding:75px;gap:50px}h1{font-size:65px;line-height:1.5;margin:0;font-weight:750}p{font-size:34px;color:#edfa71;margin:25px 0}small{font-size:24px}.text{width:790px}.symbol{font-size:220px;color:#edfa71}</style><div class="text"><h1>ফি দেই,<br>কিন্তু চাকরি নাই</h1><p>চাকরির আবেদন ফি-এর হিসাব রাখি।</p><small>বেনামী রিপোর্ট। সবার হিসাব।</small></div><div class="symbol">৳</div>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "app/opengraph-image.png" });
} finally {
  await browser.close();
}
