import "server-only";
import postgres from "postgres";
import { workerRequestContext } from "./context";
const globalDb = globalThis as unknown as {
  feeSql?: ReturnType<typeof postgres>;
};
export function db() {
  const request = workerRequestContext.getStore();
  if (request) {
    return (request.sql ??= postgres(request.connectionString, {
      max: 5,
      prepare: true,
      fetch_types: false,
      connect_timeout: 10,
      idle_timeout: 20,
    }));
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  return (globalDb.feeSql ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  }));
}
export const configured = () =>
  Boolean(
    workerRequestContext.getStore()?.connectionString ||
    process.env.DATABASE_URL,
  );
