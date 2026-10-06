// Called only by the gated production job, or explicitly by an operator.
// Secrets are attached atomically to the Worker version, never written to git/config.
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

if (process.env.ENABLE_PRODUCTION_DEPLOY !== "true")
  throw new Error(
    "Production deployment is disabled. Complete the documented setup first.",
  );
process.env.DEPLOYMENT_TARGET = "cloudflare";
await import("./check-production");
await import("./check-cloudflare");
for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"])
  if (!process.env[name]?.trim()) throw new Error(`Missing ${name}`);
const configPath = "dist/server/wrangler.json";
const original = await readFile(configPath, "utf8");
const config = JSON.parse(original);
config.hyperdrive = [{ binding: "HYPERDRIVE", id: process.env.HYPERDRIVE_ID }];
config.vars = {
  SITE_URL: process.env.SITE_URL,
  TURNSTILE_HOSTNAME: process.env.TURNSTILE_HOSTNAME,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NORMAL_FEE_MAX: process.env.NORMAL_FEE_MAX || "10000",
  LEADERBOARD_MIN_REPORTS: process.env.LEADERBOARD_MIN_REPORTS || "5",
  DEV_BYPASS_TURNSTILE: "false",
};
// Build-time public values must match this release's canonical origin and site key.
const build = JSON.parse(
  await readFile("dist/cloudflare-public-config.json", "utf8"),
);
for (const name of ["SITE_URL", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"])
  if (build[name] !== process.env[name])
    throw new Error(`Rebuild Worker: ${name} changed`);
const directory = await mkdtemp(join(tmpdir(), "chakri-release-"));
const secretPath = join(directory, "secrets.json");
try {
  await writeFile(
    secretPath,
    JSON.stringify(
      Object.fromEntries(
        [
          "TURNSTILE_SECRET_KEY",
          "ANTI_ABUSE_SECRET",
          "ADMIN_SESSION_SECRET",
          "ADMIN_PASSWORD_HASH",
        ].map((name) => [name, process.env[name]]),
      ),
    ),
    { mode: 0o600 },
  );
  await writeFile(configPath, JSON.stringify(config));
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "deploy",
        "--config",
        configPath,
        "--secrets-file",
        secretPath,
        "--strict",
      ],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0) throw new Error("Cloudflare deployment failed");
} finally {
  await writeFile(configPath, original);
  await rm(directory, { recursive: true, force: true });
}
