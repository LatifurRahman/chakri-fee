import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("production routes, real database read, SEO and security headers", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/organizations",
    "/privacy",
    "/methodology",
    "/about",
    "/admin",
    "/robots.txt",
    "/sitemap.xml",
    "/opengraph-image.png",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
  }
  const stats = await page.request.get("/api/statistics");
  expect(stats.status()).toBe(200);
  expect(await stats.json()).toEqual({
    count: 0,
    total: 0,
    mean: 0,
    median: 0,
    organizations: 0,
  });
  const response = await page.goto("/");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["content-security-policy"]).not.toContain(
    "unsafe-eval",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /localhost/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("production refuses a local CAPTCHA bypass and preserves form values", async ({
  page,
}) => {
  // The isolated fixture supplies the header a trusted production edge would inject.
  await page.setExtraHTTPHeaders({ "x-real-ip": "127.0.0.77" });
  await page.goto("/");
  await page.locator("#organization_name").fill("Production Test Bank");
  await page.locator("#fee_amount").fill("500");
  await page
    .getByRole("button", { name: "হিসাবে যোগ করুন", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText("নিরাপত্তা যাচাই");
  await expect(page.locator("#organization_name")).toHaveValue(
    "Production Test Bank",
  );
  await expect(page.locator("#fee_amount")).toHaveValue("500");
  const stats = await page.request.get("/api/statistics");
  expect((await stats.json()).count).toBe(0);
});
