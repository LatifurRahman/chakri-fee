import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("errors preserve inputs, announce the field and prevent duplicate requests", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#organization_name").fill("Error Test Bank");
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText("আবেদন ফি লিখুন");
  await expect(page.locator("#fee_amount")).toBeFocused();
  await page.locator("#fee_amount").fill("500");
  await page.locator("#role_name").fill("Officer");
  await page.route("**/api/reports", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "তথ্য জমা দেওয়া যায়নি। আবার চেষ্টা করুন।",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText("আবার চেষ্টা করুন");
  await expect(page.locator("#organization_name")).toHaveValue(
    "Error Test Bank",
  );
  await expect(page.locator("#fee_amount")).toHaveValue("500");
  await expect(page.locator("#role_name")).toHaveValue("Officer");
  let requests = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.unroute("**/api/reports");
  await page.route("**/api/reports", async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        status: "approved",
        organization_name: "Error Test Bank",
        fee_amount: 500,
        role_name: "Officer",
        slug: "error-test",
      }),
    });
  });
  const button = page.getByRole("button", {
    name: "হিসাবে যোগ করুন",
    exact: true,
  });
  await button.click();
  await expect(
    page.getByRole("button", { name: "যোগ হচ্ছে..." }),
  ).toBeDisabled();
  await page.locator("#report form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole("heading", { name: "ধন্যবাদ!" })).toBeVisible();
});
test("keyboard form entry and all public page accessibility", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "মূল বিষয়বস্তুতে যান" }),
  ).toBeFocused();
  for (const path of [
    "/",
    "/organizations",
    "/about",
    "/methodology",
    "/privacy",
    "/admin",
  ]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, `axe ${path}`).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page
    .getByLabel("প্রতিষ্ঠান / Organization")
    .fill("বাংলাদেশ ব্যাংক".repeat(10));
  await page
    .locator("#role_name")
    .fill("Assistant Director of Operations and Management");
  await page.locator("html").evaluate((el) => {
    el.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("unauthenticated admin APIs and nonexistent organizations are protected", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "অ্যাডমিন প্রবেশ" }),
  ).toBeVisible();
  const result = await page.request.post("/api/admin/moderate", {
    headers: { origin: "http://localhost:3001" },
    data: { action: "approve", id: "00000000-0000-4000-8000-000000000000" },
  });
  expect(result.status()).toBe(403);
  const missing = await page.goto("/organization/does-not-exist");
  // Next.js documents HTTP 200 for a streamed notFound response.
  expect([200, 404]).toContain(missing?.status());
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]').first(),
  ).toHaveAttribute("content", /noindex/);
  await expect(
    page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি।" }),
  ).toBeVisible();
});
