import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// The Workers test harness owns workerd and its disposable database.
// Reuse the unchanged production browser regressions against the compiled Worker.
export default defineConfig({
  ...base,
  testMatch: "**/production.spec.ts",
  webServer: undefined,
  use: { ...base.use, baseURL: "http://localhost:4173" },
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "artifacts/workers-browser-report", open: "never" },
    ],
  ],
  outputDir: "artifacts/workers-browser",
});
