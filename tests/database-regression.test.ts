import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ allowed: false }));
vi.mock("../lib/admin", () => ({ isAdmin: async () => auth.allowed }));
const url = process.env.TEST_DATABASE_URL;
const exec = promisify(execFile);
describe.skipIf(!url)("PostgreSQL release invariants", () => {
  let sql: ReturnType<typeof postgres>;
  let created = false;
  beforeAll(async () => {
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("Use a separate disposable database");
    sql = postgres(url, { max: 1, prepare: false });
    if (
      (await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`)
        .length
    )
      throw new Error("Test database must be empty");
    process.env.DATABASE_URL = url;
    process.env.SITE_URL = "http://localhost:3000";
    process.env.ANTI_ABUSE_SECRET =
      "regression-anti-abuse-secret-32-characters";
    process.env.ADMIN_SESSION_SECRET =
      "regression-admin-session-secret-32-characters";
    process.env.DEV_BYPASS_TURNSTILE = "true";
    await exec(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
      env: { ...process.env, DATABASE_URL: url },
    });
    created = true;
    await exec(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
      env: { ...process.env, DATABASE_URL: url },
    });
  });
  beforeEach(async () => {
    auth.allowed = false;
    await sql`TRUNCATE admin_audit,submission_patterns,abuse_buckets,fee_reports,organizations CASCADE`;
  });
  afterAll(async () => {
    if (sql) {
      if (created)
        await sql`DROP TABLE IF EXISTS schema_migrations,admin_audit,submission_patterns,abuse_buckets,fee_reports,organizations CASCADE`;
      await sql.end();
    }
  });
  const submit = async (
    name = "Bank",
    fee = 500,
    source = "source",
    role: string | null = "Officer",
  ) =>
    (await import("../lib/db/submit")).submitReport(
      { organization_name: name, fee_amount: fee, role_name: role },
      source,
    );
  const moderate = async (body: unknown, origin = "http://localhost:3000") =>
    (await import("../app/api/admin/moderate/route")).POST(
      new Request("http://localhost:3000/api/admin/moderate", {
        method: "POST",
        headers: { origin },
        body: JSON.stringify(body),
      }),
    );
  it("migrations are idempotent and leave one recorded version", async () => {
    expect(
      (await sql`SELECT count(*)::int AS count FROM schema_migrations`)[0]
        .count,
    ).toBe(1);
  });
  it("returns correct empty and even medians while excluding all private statuses", async () => {
    const { getStats, organization } = await import("../lib/db/queries");
    expect(await getStats()).toEqual({
      count: 0,
      total: 0,
      mean: 0,
      median: 0,
      organizations: 0,
    });
    const a = await submit("Bank", 0, "a");
    await submit("Bank", 501, "b");
    await submit("Bank", 999999, "c");
    const [o] = await sql`SELECT id FROM organizations`;
    for (const status of ["pending", "rejected"])
      await sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,fee_amount,status) VALUES(${o.id},'Bank','bank',999999,${status})`;
    expect((await getStats()).median).toBe(250.5);
    expect((await getStats()).total).toBe(501);
    expect((await organization(a.slug))?.maximum).toBe(501);
  });
  it("keeps the threshold inclusive and respects a configured override", async () => {
    expect((await submit("Threshold", 10000, "a")).status).toBe("approved");
    expect((await submit("Threshold", 10001, "b")).status).toBe("flagged");
    vi.stubEnv("NORMAL_FEE_MAX", "100");
    try {
      expect((await submit("Custom", 101, "c")).status).toBe("flagged");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("accepts identical fees from independent sources and after pattern expiry", async () => {
    expect((await submit("Bank", 500, "a")).status).toBe("approved");
    expect((await submit("Bank", 500, "b")).status).toBe("approved");
    expect((await submit("Bank", 500, "a")).status).toBe("flagged");
    await sql`UPDATE submission_patterns SET expires_at=now()-interval '1 second'`;
    expect((await submit("Bank", 500, "a")).status).toBe("approved");
  });
  it("concurrent normalized names create a single canonical organization", async () => {
    await Promise.all(
      ["Bank", "BANK.", " bank "].map((n, i) =>
        submit(n, 100 + i, `concurrent-${i}`),
      ),
    );
    expect(
      (await sql`SELECT count(*)::int AS count FROM organizations`)[0].count,
    ).toBe(1);
    expect(
      (await sql`SELECT count(*)::int AS count FROM fee_reports`)[0].count,
    ).toBe(3);
  });
  it("rate limits remain atomic under concurrency and reset after expiry", async () => {
    const { rateLimit } = await import("../lib/security");
    const results = await Promise.all(
      Array.from({ length: 12 }, () => rateLimit("burst", 5)),
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    await sql`UPDATE abuse_buckets SET expires_at=now()-interval '1 second'`;
    expect(await rateLimit("burst", 5)).toBe(true);
    expect(await rateLimit("other", 1)).toBe(true);
    expect(await rateLimit("other", 1)).toBe(false);
  });
  it("requires exactly the minimum approved sample size for median rankings", async () => {
    for (let i = 0; i < 4; i++) await submit("Rank Bank", 500, `rank-${i}`);
    const { organizations } = await import("../lib/db/queries");
    expect(await organizations("", "median")).toHaveLength(0);
    await submit("Rank Bank", 700, "rank-4");
    expect(await organizations("", "median")).toHaveLength(1);
    vi.stubEnv("LEADERBOARD_MIN_REPORTS", "6");
    try {
      expect(await organizations("", "median")).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("searches roles/Bangla case-insensitively and never exposes unapproved names", async () => {
    await submit("বাংলাদেশ ব্যাংক", 300, "a", "সহকারী পরিচালক");
    await submit("Public Bank", 500, "b", "Senior Officer");
    await submit("Hidden Bank", 50000, "c");
    const { organizations, autocomplete, organization } =
      await import("../lib/db/queries");
    expect((await organizations("OFFICER"))[0].name).toBe("Public Bank");
    expect((await organizations("সহকারী"))[0].name).toBe("বাংলাদেশ ব্যাংক");
    expect(await autocomplete("hidden")).toHaveLength(0);
    expect(await organization("missing-slug")).toBeUndefined();
    expect(await organizations("' OR 1=1 --")).toHaveLength(0);
  });
  it("unauthenticated or cross-origin admin operations cannot change records", async () => {
    const a = await submit();
    const [o] = await sql`SELECT id FROM organizations`;
    expect(
      (await moderate({ action: "rename", id: o.id, name: "Changed" })).status,
    ).toBe(403);
    auth.allowed = true;
    expect(
      (
        await moderate(
          { action: "rename", id: o.id, name: "Changed" },
          "https://evil.test",
        )
      ).status,
    ).toBe(403);
    expect(
      (await sql`SELECT name FROM organizations WHERE slug=${a.slug}`)[0].name,
    ).toBe("Bank");
  });
  it("approval and rejection change aggregates without editing fee values", async () => {
    await submit("Outlier", 20000, "a");
    const [r] = await sql`SELECT id FROM fee_reports`;
    auth.allowed = true;
    expect((await moderate({ action: "approve", id: r.id })).status).toBe(200);
    const { getStats } = await import("../lib/db/queries");
    expect((await getStats()).total).toBe(20000);
    expect((await moderate({ action: "reject", id: r.id })).status).toBe(200);
    expect((await getStats()).count).toBe(0);
    expect((await sql`SELECT fee_amount FROM fee_reports`)[0].fee_amount).toBe(
      20000,
    );
    expect(await sql`SELECT action FROM admin_audit`).toHaveLength(2);
  });
  it("rename updates search, and duplicate canonical names roll back", async () => {
    await submit("Bank", 500, "a");
    await submit("Other Bank", 500, "b");
    const [o] = await sql`SELECT id FROM organizations WHERE name='Bank'`;
    auth.allowed = true;
    expect(
      (await moderate({ action: "rename", id: o.id, name: "Renamed Bank" }))
        .status,
    ).toBe(200);
    const { organizations } = await import("../lib/db/queries");
    expect((await organizations("renamed"))[0].name).toBe("Renamed Bank");
    expect(
      (await moderate({ action: "rename", id: o.id, name: "Other Bank" }))
        .status,
    ).toBe(400);
    expect(
      (await sql`SELECT name FROM organizations WHERE id=${o.id}`)[0].name,
    ).toBe("Renamed Bank");
    expect(
      (
        await sql`SELECT organization_name FROM fee_reports WHERE organization_id=${o.id}`
      )[0].organization_name,
    ).toBe("Bank");
  });
  it("merge moves every status, retains original values and prevents invalid targets", async () => {
    await submit("Source", 500, "a");
    await submit("Source", 50000, "b");
    await submit("Target", 300, "c");
    const [source] =
      await sql`SELECT id FROM organizations WHERE name='Source'`;
    const [target] =
      await sql`SELECT id FROM organizations WHERE name='Target'`;
    auth.allowed = true;
    expect(
      (await moderate({ action: "merge", id: source.id, target: source.id }))
        .status,
    ).toBe(400);
    expect(
      (
        await moderate({
          action: "merge",
          id: source.id,
          target: "00000000-0000-4000-8000-000000000000",
        })
      ).status,
    ).toBe(400);
    expect(
      await sql`SELECT id FROM organizations WHERE id=${source.id}`,
    ).toHaveLength(1);
    expect(
      (await moderate({ action: "merge", id: source.id, target: target.id }))
        .status,
    ).toBe(200);
    expect(
      await sql`SELECT id FROM organizations WHERE id=${source.id}`,
    ).toHaveLength(0);
    expect(
      await sql`SELECT id FROM fee_reports WHERE organization_id=${target.id}`,
    ).toHaveLength(3);
    expect(
      (await sql`SELECT sum(fee_amount)::int AS total FROM fee_reports`)[0]
        .total,
    ).toBe(50800);
    expect(
      await sql`SELECT id FROM fee_reports WHERE organization_name='Source'`,
    ).toHaveLength(2);
  });
  it.each([
    { action: "unknown", id: "00000000-0000-4000-8000-000000000000" },
    { action: "approve", id: "bad-id" },
    { action: "approve", id: "00000000-0000-4000-8000-000000000000" },
    {
      action: "rename",
      id: "00000000-0000-4000-8000-000000000000",
      name: "<script>",
    },
  ])("rejects invalid admin operations %j", async (body) => {
    auth.allowed = true;
    expect((await moderate(body)).status).toBe(400);
    expect(await sql`SELECT id FROM admin_audit`).toHaveLength(0);
  });
  it("database constraints reject invalid fee/status/foreign key", async () => {
    await submit();
    const [o] = await sql`SELECT id FROM organizations`;
    await expect(
      sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,fee_amount,status) VALUES(${o.id},'Bank','bank',-1,'approved')`,
    ).rejects.toThrow();
    await expect(
      sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,fee_amount,status) VALUES(${o.id},'Bank','bank',1,'invalid')`,
    ).rejects.toThrow();
    await expect(
      sql`DELETE FROM organizations WHERE id=${o.id}`,
    ).rejects.toThrow();
  });
  it("production seed is refused even with the development override", async () => {
    await expect(
      exec(process.execPath, ["--import", "tsx", "scripts/seed.ts"], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          ALLOW_DEV_SEED: "true",
          DATABASE_URL: url,
        },
      }),
    ).rejects.toThrow();
    expect(await sql`SELECT id FROM organizations`).toHaveLength(0);
  });
  it("RLS blocks a non-owner reader even when SELECT privileges are granted", async () => {
    await submit();
    const role = `fee_test_reader_${process.pid}`;
    let roleCreated = false;
    try {
      await sql.unsafe(`CREATE ROLE ${role} NOLOGIN`);
      roleCreated = true;
      await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await sql.unsafe(`GRANT SELECT ON organizations,fee_reports TO ${role}`);
      await sql.unsafe(`SET ROLE ${role}`);
      expect(await sql`SELECT id FROM fee_reports`).toHaveLength(0);
      expect(await sql`SELECT id FROM organizations`).toHaveLength(0);
    } finally {
      await sql`RESET ROLE`;
      if (roleCreated) {
        await sql.unsafe(`DROP OWNED BY ${role}`);
        await sql.unsafe(`DROP ROLE ${role}`);
      }
    }
  });
  it("login cookies and rate limit are enforced; logout expires the cookie", async () => {
    const { passwordHash } = await import("../lib/security");
    process.env.ADMIN_PASSWORD_HASH = passwordHash("regression-password");
    const { POST: login } = await import("../app/api/admin/login/route");
    const request = (password: string) =>
      new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-for": "127.0.0.10",
        },
        body: JSON.stringify({ password }),
      });
    expect((await login(request("wrong"))).status).toBe(401);
    const result = await login(request("regression-password"));
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.headers.get("set-cookie")).toContain("SameSite=strict");
    for (let i = 0; i < 3; i++) await login(request("wrong"));
    expect((await login(request("wrong"))).status).toBe(429);
    const { POST: logout } = await import("../app/api/admin/logout/route");
    expect(
      (
        await logout(
          new Request("http://localhost:3000/api/admin/logout", {
            method: "POST",
            headers: { origin: "http://localhost:3000" },
          }),
        )
      ).headers.get("set-cookie"),
    ).toContain("Expires=Thu, 01 Jan 1970");
  });
});
