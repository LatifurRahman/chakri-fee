// Tests the actual compiled Worker in workerd, with a disposable PostgreSQL origin.
// This does not emulate Hyperdrive's remote pooling/cache or call real CAPTCHA.
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { scryptSync } from "node:crypto";
import assert from "node:assert/strict";

const directory = await mkdtemp(join(tmpdir(), "chakri-workers-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(directory, "db"),
  user: "postgres",
  password: "worker-fixture-only",
  port: 55434,
  persistent: false,
  onLog: () => {},
  onError: console.error,
  postgresFlags: ["-k", directory],
});
const configPath = "dist/server/wrangler.json";
const originalConfig = await readFile(configPath, "utf8");
const origin = "http://localhost:4173";
let child: ChildProcess | undefined;
let sql: ReturnType<typeof postgres> | undefined;
let exitCode = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("fee_workers");
  const url =
    "postgresql://postgres:worker-fixture-only@127.0.0.1:55434/fee_workers";
  sql = postgres(url, { max: 1 });
  await sql.unsafe(await readFile("migrations/001_initial.sql", "utf8"));
  const [org] =
    await sql`INSERT INTO organizations(name,normalized_name,slug) VALUES('Worker Test Bank','worker test bank','worker-test-bank') RETURNING id`;
  for (const [amount, status] of [
    [300, "approved"],
    [500, "approved"],
    [700, "approved"],
    [20000, "flagged"],
  ] as const)
    await sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,role_name,fee_amount,status) VALUES(${org.id},'Worker Test Bank','worker test bank','Officer',${amount},${status})`;
  const config = JSON.parse(originalConfig);
  config.hyperdrive[0].localConnectionString = url;
  const salt = "a".repeat(32);
  config.vars = {
    ...config.vars,
    SITE_URL: origin,
    TURNSTILE_HOSTNAME: "localhost",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET_KEY: "fixture-only",
    ANTI_ABUSE_SECRET: "a".repeat(64),
    ADMIN_SESSION_SECRET: "b".repeat(64),
    ADMIN_PASSWORD_HASH: `${salt}:${scryptSync("worker-fixture-password", salt, 64).toString("hex")}`,
    // Must remain ignored by the production Worker.
    DEV_BYPASS_TURNSTILE: "true",
  };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
  child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/cloudflare.ts",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null)
      throw new Error("Workers preview exited early");
    try {
      if ((await fetch(origin + "/api/statistics")).ok) break;
    } catch {}
    if (i === 119) throw new Error("Workers preview readiness timed out");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const json = async (path: string) => {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200, path);
    return r.json();
  };
  assert.deepEqual(await json("/api/statistics"), {
    count: 3,
    total: 1500,
    mean: 500,
    median: 500,
    organizations: 1,
  });
  process.env.DEPLOYMENT_URL = origin;
  await import("./smoke");
  const home = await fetch(origin);
  const html = await home.text();
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.ok(
    !home.headers.get("content-security-policy")?.includes("unsafe-eval"),
  );
  assert.ok(html.includes("৳৫০০"));
  assert.ok(html.includes("organization_name"));
  for (const path of [
    "/organizations?q=OFFICER",
    "/organization/worker-test-bank",
    "/privacy",
    "/methodology",
    "/about",
    "/admin",
    "/robots.txt",
    "/sitemap.xml",
    "/opengraph-image.png",
    "/fonts/bangla.woff2",
  ])
    assert.equal((await fetch(origin + path)).status, 200, path);
  const matches = await json("/api/organizations?q=worker");
  assert.ok(JSON.stringify(matches).includes("Worker Test Bank"));
  const post = (
    path: string,
    body: unknown,
    cookie = "",
    originHeader = origin,
  ) =>
    fetch(origin + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: originHeader,
        cookie,
        "cf-connecting-ip": "127.0.0.77",
        "x-real-ip": "spoofed",
        "x-forwarded-for": "spoofed",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await post("/api/reports", {}, "", "https://evil.example")).status,
    403,
  );
  const report = await post("/api/reports", {
    organization_name: "New Worker Bank",
    fee_amount: 500,
    anti_spam_token: "",
  });
  assert.equal(report.status, 400);
  assert.ok(JSON.stringify(await report.json()).includes("নিরাপত্তা যাচাই"));
  assert.equal(
    (await post("/api/admin/moderate", { action: "approve", id: org.id }))
      .status,
    403,
  );
  const login = await post("/api/admin/login", {
    password: "worker-fixture-password",
  });
  assert.equal(login.status, 200, "scrypt password verification in workerd");
  const cookie = login.headers.get("set-cookie")!;
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("Secure"));
  const session = cookie.split(";")[0];
  const [flagged] =
    await sql`SELECT id FROM fee_reports WHERE status='flagged'`;
  assert.equal(
    (
      await post(
        "/api/admin/moderate",
        { action: "approve", id: flagged.id },
        session,
      )
    ).status,
    200,
  );
  const after = await json("/api/statistics");
  assert.equal(after.count, 4);
  assert.equal(after.total, 21500);
  assert.equal(after.median, 600);
  // Independent requests must create fresh request-owned sockets and see the latest data.
  const results = await Promise.all(
    Array.from({ length: 12 }, () => json("/api/statistics")),
  );
  assert.ok(results.every((r) => r.count === 4));
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      post("/api/reports", {
        organization_name: "Spam Fixture",
        fee_amount: 1,
      }),
    ),
  );
  assert.ok(
    attempts.some((r) => r.status === 429),
    "database-backed rate limiting",
  );
  const [stored] = await sql`SELECT count(*)::int AS count FROM fee_reports`;
  assert.equal(stored.count, 4);
  assert.equal((await post("/api/admin/logout", {}, session)).status, 200);
  console.log(
    "Workers runtime regression passed: PostgreSQL reads/writes, streaming, fresh aggregates, concurrent request isolation, moderation/auth/scrypt, CAPTCHA refusal, origin/rate protection, routes/assets/SEO/security headers.",
  );
  await sql`TRUNCATE fee_reports,organizations,abuse_buckets,submission_patterns,admin_audit CASCADE`;
  const browserCode = await new Promise<number | null>((resolve, reject) => {
    const browser = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.cloudflare.config.ts",
      ],
      { stdio: "inherit", env: process.env },
    );
    browser.once("error", reject);
    browser.once("exit", resolve);
  });
  assert.equal(
    browserCode,
    0,
    "unchanged production browser suite against workerd",
  );
  exitCode = 0;
} finally {
  if (child && child.exitCode === null) {
    const stopped = new Promise((resolve) => child!.once("exit", resolve));
    child.kill("SIGTERM");
    await Promise.race([
      stopped,
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await writeFile(configPath, originalConfig);
  await sql?.end({ timeout: 5 });
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
}
process.exit(exitCode);
