import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command: "tsx scripts/browser-server.ts",
    url: "http://localhost:3001",
    timeout: 120000,
    reuseExistingServer: false,
  },
  reporter: "list",
  outputDir: "artifacts/browser",
});
