import EmbeddedPostgres from "embedded-postgres";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
const directory = await mkdtemp(join(tmpdir(), "fee-integration-"));
const pg = new EmbeddedPostgres({
  databaseDir: join(directory, "db"),
  user: "postgres",
  password: "local-test-only",
  port: 55432,
  persistent: false,
  onLog: () => {},
  onError: console.error,
  postgresFlags: ["-k", directory],
});
let exitCode = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("fee_test");
  const code = await new Promise<number | null>((resolve) => {
    const child = spawn("npm", ["test", ...process.argv.slice(2)], {
      stdio: "inherit",
      env: {
        ...process.env,
        TEST_DATABASE_URL:
          "postgresql://postgres:local-test-only@localhost:55432/fee_test",
      },
    });
    child.on("exit", resolve);
  });
  exitCode = code ?? 1;
} finally {
  await pg.stop();
  await rm(directory, { recursive: true, force: true });
}

process.exit(exitCode);
