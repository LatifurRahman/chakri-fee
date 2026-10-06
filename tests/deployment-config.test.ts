import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const config = {
  ...process.env,
  DATABASE_URL:
    "postgresql://owner:fixture-only@database.example.test:5432/postgres?sslmode=require",
  SITE_URL: "https://chakri.example.test",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture-public",
  TURNSTILE_SECRET_KEY: "fixture-secret",
  TURNSTILE_HOSTNAME: "chakri.example.test",
  ANTI_ABUSE_SECRET: "a".repeat(32),
  ADMIN_SESSION_SECRET: "b".repeat(32),
  ADMIN_PASSWORD_HASH: "a".repeat(32) + ":" + "b".repeat(128),
  DEV_BYPASS_TURNSTILE: "false",
};
describe("production release configuration gate", () => {
  it("accepts complete configuration without printing any secret values", async () => {
    const result = await run(
      process.execPath,
      ["--import", "tsx", "scripts/check-production.ts"],
      { env: config },
    );
    expect(result.stdout).toContain("configuration is present");
    expect(result.stdout).not.toContain("fixture-secret");
    expect(result.stdout).not.toContain("fixture-only");
  });
  it.each([
    { DATABASE_URL: "" },
    { SITE_URL: "http://chakri.example.test" },
    { TURNSTILE_HOSTNAME: "wrong.example.test" },
    { ANTI_ABUSE_SECRET: "short" },
    { ADMIN_SESSION_SECRET: "a".repeat(32) },
    { ADMIN_PASSWORD_HASH: "bad" },
    { DEV_BYPASS_TURNSTILE: "true" },
    { DATABASE_URL: "postgresql://localhost:5432/test" },
  ])("blocks incomplete or unsafe configuration %j", async (override) => {
    await expect(
      run(
        process.execPath,
        ["--import", "tsx", "scripts/check-production.ts"],
        { env: { ...config, ...override } },
      ),
    ).rejects.toThrow();
  });
});
