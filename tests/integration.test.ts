import { afterAll, beforeAll, describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
vi.mock("server-only", () => ({}));
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("isolated PostgreSQL integration", () => {
  let sql: ReturnType<typeof postgres>;
  let created = false;
  beforeAll(async () => {
    if (!url || url === process.env.DATABASE_URL)
      throw new Error(
        "TEST_DATABASE_URL must be a separate disposable database",
      );
    sql = postgres(url, { max: 1, prepare: false });
    const existing =
      await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    if (existing.length) throw new Error("Integration database must be empty");
    process.env.DATABASE_URL = url;
    process.env.ANTI_ABUSE_SECRET = "integration-secret-with-at-least-32-chars";
    process.env.SITE_URL = "http://localhost:3000";
    process.env.DEV_BYPASS_TURNSTILE = "true";
    await sql.unsafe(await readFile("migrations/001_initial.sql", "utf8"));
    created = true;
  });
  afterAll(async () => {
    if (sql) {
      if (created)
        await sql`DROP TABLE IF EXISTS admin_audit,submission_patterns,abuse_buckets,fee_reports,organizations CASCADE`;
      await sql.end();
    }
  });
  it("submits, flags repeated technical patterns/outliers, and excludes unapproved records", async () => {
    const { submitReport } = await import("../lib/db/submit");
    const { getStats, organizations, organization, autocomplete } =
      await import("../lib/db/queries");
    const input = {
      organization_name: "Bangladesh Bank",
      fee_amount: 500,
      role_name: "Officer",
    };
    expect((await submitReport(input, "source-a")).status).toBe("approved");
    expect((await submitReport(input, "source-a")).status).toBe("flagged");
    expect(
      (await submitReport({ ...input, fee_amount: 50000 }, "source-b")).status,
    ).toBe("flagged");
    await submitReport(
      { ...input, organization_name: " bangladesh BANK. ", fee_amount: 300 },
      "source-c",
    );
    await submitReport(
      { ...input, organization_name: "বাংলাদেশ ব্যাংক", fee_amount: 200 },
      "source-d",
    );
    const stats = await getStats();
    expect(stats).toEqual({
      count: 3,
      total: 1000,
      mean: 1000 / 3,
      median: 300,
      organizations: 2,
    });
    expect((await organizations("OFFICER")).length).toBe(2);
    expect((await organizations("বাংলাদেশ")).length).toBe(1);
    expect((await autocomplete("bangla"))[0].name).toBe("Bangladesh Bank");
    const org = (await organizations("bangladesh"))[0];
    expect((await organization(org.slug))?.median).toBe(400);
    expect((await organizations("", "median")).length).toBe(0);
  });
  it("limits repeated anonymous requests atomically", async () => {
    const { rateLimit } = await import("../lib/security");
    expect(await rateLimit("rate-test", 2)).toBe(true);
    expect(await rateLimit("rate-test", 2)).toBe(true);
    expect(await rateLimit("rate-test", 2)).toBe(false);
  });
  it("validates API submissions, blocks CSRF and succeeds anonymously", async () => {
    const { POST } = await import("../app/api/reports/route");
    const req = (body: unknown, origin = "http://localhost:3000") =>
      new Request("http://localhost:3000/api/reports", {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify(body),
      });
    expect(
      (await POST(req({ organization_name: "", fee_amount: 100 }))).status,
    ).toBe(422);
    expect(
      (
        await POST(
          req(
            { organization_name: "Bank", fee_amount: 100 },
            "https://evil.test",
          ),
        )
      ).status,
    ).toBe(403);
    const result = await POST(
      req({
        organization_name: "Test University",
        fee_amount: 700,
        role_name: "Lecturer",
      }),
    );
    expect(result.status).toBe(201);
    expect(await result.json()).not.toHaveProperty("id");
  });
});
