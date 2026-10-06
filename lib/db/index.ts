import "server-only";
import postgres from "postgres";
const globalDb = globalThis as unknown as {
  feeSql?: ReturnType<typeof postgres>;
};
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  return (globalDb.feeSql ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  }));
}
export const configured = () => Boolean(process.env.DATABASE_URL);
