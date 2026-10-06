import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
if (!process.env.DATABASE_URL)
  throw new Error(
    "Set DATABASE_URL; use node --env-file=.env.local --import tsx scripts/migrate.ts",
  );
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(7112026)`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`;
    for (const file of (await readdir("migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const found =
        await tx`SELECT name FROM schema_migrations WHERE name=${file}`;
      if (found.length) continue;
      await tx.unsafe(await readFile(`migrations/${file}`, "utf8"));
      await tx`INSERT INTO schema_migrations(name) VALUES(${file})`;
      console.log(`Applied ${file}`);
    }
  });
} finally {
  await sql.end();
}
