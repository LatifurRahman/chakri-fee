import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { scryptSync } from "node:crypto";
import postgres from "postgres";
const directory = await mkdtemp(join(tmpdir(), "fee-browser-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(directory, "db"),
  user: "postgres",
  password: "browser-only",
  port: 55433,
  persistent: false,
  onLog: () => {},
  onError: console.error,
  postgresFlags: ["-k", directory],
});
await pg.initialise();
await pg.start();
await pg.createDatabase("fee_browser");
const url = "postgresql://postgres:browser-only@localhost:55433/fee_browser";
const sql = postgres(url, { max: 1 });
await sql.unsafe(await readFile("migrations/001_initial.sql", "utf8"));
await sql.end();
const salt = "browser-test-salt";
const child = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    process.env.BROWSER_PRODUCTION === "true" ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      SITE_URL: "http://localhost:3001",
      DEV_BYPASS_TURNSTILE: "true",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      ANTI_ABUSE_SECRET: "test-browser-anti-abuse-secret-32-characters",
      ADMIN_SESSION_SECRET: "test-browser-admin-secret-32-characters",
      ADMIN_PASSWORD_HASH: `${salt}:${scryptSync("browser-test-password", salt, 64).toString("hex")}`,
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
  process.exit();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
