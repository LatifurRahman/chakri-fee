import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm, readFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import postgres from "postgres";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
const directory = await mkdtemp(join(tmpdir(), "chakri-performance-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(directory, "db"),
  user: "postgres",
  password: "benchmark-only",
  port: 55434,
  persistent: false,
  onLog: () => {},
  onError: console.error,
  postgresFlags: ["-k", directory],
});
let child: ReturnType<typeof spawn> | undefined;
let exitCode = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("fee_benchmark");
  const url =
    "postgresql://postgres:benchmark-only@localhost:55434/fee_benchmark";
  const sql = postgres(url, { max: 1 });
  await sql.unsafe(await readFile("migrations/001_initial.sql", "utf8"));
  await sql`INSERT INTO organizations(name,normalized_name,slug) SELECT '[BENCH] Organization '||i,'bench organization '||i,'bench-organization-'||i FROM generate_series(1,100) i`;
  await sql`INSERT INTO fee_reports(organization_id,organization_name,normalized_organization_name,role_name,fee_amount,status) SELECT o.id,o.name,o.normalized_name,'BENCH Officer',100+g*10,'approved' FROM organizations o CROSS JOIN generate_series(1,100) g`;
  await sql.end();
  child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3002",
    ],
    {
      stdio: ["ignore", "ignore", "inherit"],
      env: {
        ...process.env,
        DATABASE_URL: url,
        SITE_URL: "http://localhost:3002",
      },
    },
  );
  const origin = "http://localhost:3002";
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(origin);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Benchmark server not ready");
  const routes = [
    "/",
    "/api/statistics",
    "/organizations?q=Officer",
    "/api/organizations?q=bench",
    "/organization/bench-organization-1",
  ];
  const times: number[] = [];
  let failures = 0;
  const start = performance.now();
  await Promise.all(
    Array.from({ length: 10 }, async (_, worker) => {
      for (let i = 0; i < 20; i++) {
        const before = performance.now();
        try {
          const r = await fetch(origin + routes[(worker + i) % routes.length], {
            signal: AbortSignal.timeout(10000),
          });
          await r.arrayBuffer();
          if (!r.ok) failures++;
        } catch {
          failures++;
        }
        times.push(performance.now() - before);
      }
    }),
  );
  times.sort((a, b) => a - b);
  const report = {
    scope: "localhost only; not a hosting capacity guarantee",
    records: 10000,
    organizations: 100,
    concurrency: 10,
    requests: 200,
    failures,
    p95_ms: Math.round(times[Math.ceil(times.length * 0.95) - 1]),
    p99_ms: Math.round(times[Math.ceil(times.length * 0.99) - 1]),
    requests_per_second: Number(
      (200 / ((performance.now() - start) / 1000)).toFixed(1),
    ),
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/load.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (failures) throw new Error("Load probe returned failures");
  const chrome = await launch({
    chromePath: process.env.CHROMIUM_PATH,
    chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const result = await lighthouse(origin, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    if (!result) throw new Error("Lighthouse returned no report");
    await writeFile("artifacts/lighthouse.json", result.report as string);
    console.log(
      JSON.stringify({
        lighthouse: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([k, v]) => [
            k,
            Math.round((v.score ?? 0) * 100),
          ]),
        ),
      }),
    );
  } finally {
    await chrome.kill();
  }
  exitCode = 0;
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child!.once("exit", resolve));
    child.kill("SIGTERM");
    await exited;
  }
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
}
process.exit(exitCode);
