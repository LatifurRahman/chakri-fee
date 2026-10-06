import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("anonymous reporting, flagged moderation and merge", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText(
    "প্রতিষ্ঠানের নাম লিখুন",
  );
  await page.getByLabel("প্রতিষ্ঠান / Organization").fill("Bangladesh Bank");
  await page.getByLabel("আবেদন ফি").fill("500");
  await page.getByLabel("পদ / Position").fill("Officer");
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "ধন্যবাদ!" })).toBeVisible();
  await expect(page.locator("#statistics")).toContainText("৳৫০০");
  await page.getByRole("button", { name: "আরেকটি ফি যোগ করুন" }).click();
  await page.getByLabel("প্রতিষ্ঠান / Organization").fill("Test University");
  await page.getByLabel("আবেদন ফি").fill("20000");
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.locator("#report")).toContainText(
    "যাচাইয়ের পরে হিসাবে যোগ হবে",
  );
  await expect(page.locator("#statistics")).toContainText("৳৫০০");
  await page.goto("/admin");
  await page.getByLabel("পাসওয়ার্ড").fill("browser-test-password");
  await page.getByRole("button", { name: "প্রবেশ করুন", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "রিপোর্ট পর্যালোচনা" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "অনুমোদন", exact: true }).click();
  await expect(
    page.getByText("পর্যালোচনার জন্য কোনো রিপোর্ট নেই।"),
  ).toBeVisible();
  const source = page
    .locator(".org-card")
    .filter({ has: page.getByRole("heading", { name: /Test University/ }) });
  const targetValue = await source
    .locator("select option")
    .filter({ hasText: "Bangladesh Bank" })
    .getAttribute("value");
  await source.locator("select").selectOption(targetValue!);
  page.once("dialog", (dialog) => dialog.accept());
  await source.getByRole("button", { name: "Merge করুন" }).click();
  await expect(
    page.getByRole("heading", { name: /Test University/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "লগ আউট" }).click();
  await expect(
    page.getByRole("heading", { name: "অ্যাডমিন প্রবেশ" }),
  ).toBeVisible();
  await page.goto("/organizations?q=OFFICER");
  await page.getByRole("link", { name: /Bangladesh Bank/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bangladesh Bank", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-stats")).toContainText("৳১০,২৫০");
});
test("mobile widths, keyboard labels, accessibility and trust pages", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/organizations",
      "/privacy",
      "/methodology",
      "/about",
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${route} at ${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
});
