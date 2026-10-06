import { loadEnv } from "vite";
import { spawn } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";

const command = process.argv[2] || "build";
if (!["build", "dev", "preview"].includes(command))
  throw new Error("Unknown Workers command");
// vinext and Next generate different declarations at these same paths.
// Restore Next's generated files even on a failed Workers build.
const files = ["next-env.d.ts", ".next/types/routes.d.ts"];
const previous = await Promise.all(
  files.map(async (path) => {
    try {
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return undefined;
    }
  }),
);
const local = loadEnv(
  command === "dev" ? "development" : "production",
  process.cwd(),
  "",
);
// Only public settings are transferred from Next's .env.local to the build.
const publicConfig = {
  SITE_URL: process.env.SITE_URL || local.SITE_URL || "http://localhost:3000",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    local.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    "",
};
let exitCode = 1;
try {
  exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/vite/bin/vite.js", command, ...process.argv.slice(3)],
      {
        stdio: "inherit",
        env: { ...process.env, ...publicConfig },
      },
    );
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGINT", terminate);
    process.once("SIGTERM", terminate);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGINT", terminate);
      process.removeListener("SIGTERM", terminate);
      resolve(code ?? 1);
    });
  });
  if (command === "build" && exitCode === 0)
    await writeFile(
      "dist/cloudflare-public-config.json",
      JSON.stringify(publicConfig),
    );
} finally {
  for (let i = 0; i < files.length; i++) {
    if (previous[i]) await writeFile(files[i], previous[i]!);
    else await rm(files[i], { force: true });
  }
}
process.exit(exitCode);
