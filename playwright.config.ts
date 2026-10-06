import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  testMatch:
    process.env.BROWSER_PRODUCTION === "true"
      ? "**/production.spec.ts"
      : "**/!(*production).spec.ts",
  timeout: 60000,
  use: {
    browserName:
      process.env.BROWSER_NAME === "firefox" ? "firefox" : "chromium",
    baseURL: "http://localhost:3001",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions:
      process.env.CHROMIUM_PATH && process.env.BROWSER_NAME !== "firefox"
        ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
        : {},
  },
  webServer: {
    command: "tsx scripts/browser-server.ts",
    url: "http://localhost:3001",
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "artifacts/playwright-report", open: "never" }],
  ],
  outputDir: "artifacts/browser",
});
