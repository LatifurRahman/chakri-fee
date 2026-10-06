import { AsyncLocalStorage } from "node:async_hooks";
import type postgres from "postgres";

// Workers sockets cannot be shared across requests. Node keeps its existing pool.
export type WorkerRequestContext = {
  connectionString: string;
  sql?: ReturnType<typeof postgres>;
};
export const workerRequestContext =
  new AsyncLocalStorage<WorkerRequestContext>();
