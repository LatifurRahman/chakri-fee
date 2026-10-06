import type {
  Fetcher,
  Hyperdrive,
  ExecutionContext,
} from "@cloudflare/workers-types";
import handler from "vinext/server/fetch-handler";
import {
  workerRequestContext,
  type WorkerRequestContext,
} from "../lib/db/context";

interface Env {
  ASSETS: Fetcher;
  HYPERDRIVE: Hyperdrive;
}

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (!env.HYPERDRIVE?.connectionString)
      return new Response("Database binding unavailable", { status: 503 });
    const scope: WorkerRequestContext = {
      connectionString: env.HYPERDRIVE.connectionString,
    };
    return workerRequestContext.run(scope, async () => {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        if (scope.sql) ctx.waitUntil(scope.sql.end({ timeout: 5 }));
      };
      try {
        const response = await handler.fetch(request, env, ctx);
        if (!response.body) {
          close();
          return response;
        }
        // Keep sockets alive until streamed server rendering has completed.
        const reader = response.body.getReader();
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const chunk = await reader.read();
              if (chunk.done) {
                controller.close();
                close();
              } else controller.enqueue(chunk.value);
            } catch (error) {
              controller.error(error);
              close();
            }
          },
          async cancel(reason) {
            try {
              await reader.cancel(reason);
            } finally {
              close();
            }
          },
        });
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (error) {
        close();
        throw error;
      }
    });
  },
};

export default worker;
