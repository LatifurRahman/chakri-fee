import { describe, it, expect, vi, beforeEach } from "vitest";
import type postgres from "postgres";
const fetchHandler = vi.hoisted(() => vi.fn());
vi.mock("vinext/server/fetch-handler", () => ({
  default: { fetch: fetchHandler },
}));
import worker from "../worker/index";
import { workerRequestContext } from "../lib/db/context";

const env = {
  HYPERDRIVE: { connectionString: "fixture" },
  ASSETS: {},
} as Parameters<typeof worker.fetch>[1];
let end: ReturnType<typeof vi.fn>;
let waitUntil: ReturnType<typeof vi.fn>;
const ctx = () =>
  ({ waitUntil }) as unknown as Parameters<typeof worker.fetch>[2];
beforeEach(() => {
  end = vi.fn(() => Promise.resolve());
  waitUntil = vi.fn();
  fetchHandler.mockReset();
});
function attachClient() {
  workerRequestContext.getStore()!.sql = { end } as unknown as ReturnType<
    typeof postgres
  >;
}
describe("Worker database lifecycle", () => {
  it("fails closed without the Hyperdrive binding", async () => {
    expect(
      (
        await worker.fetch(
          new Request("https://site.test"),
          {} as typeof env,
          ctx(),
        )
      ).status,
    ).toBe(503);
    expect(fetchHandler).not.toHaveBeenCalled();
  });
  it("retains the client until the streamed response is consumed", async () => {
    let release: (() => void) | undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchHandler.mockImplementation(async () => {
      attachClient();
      return new Response(
        new ReadableStream({
          async start(controller) {
            await delayed;
            controller.enqueue(new TextEncoder().encode("complete"));
            controller.close();
          },
        }),
      );
    });
    const response = await worker.fetch(
      new Request("https://site.test"),
      env,
      ctx(),
    );
    expect(end).not.toHaveBeenCalled();
    release!();
    expect(await response.text()).toBe("complete");
    expect(end).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(workerRequestContext.getStore()).toBeUndefined();
  });
  it("closes the request client on cancellation", async () => {
    const cancelled = vi.fn();
    fetchHandler.mockImplementation(async () => {
      attachClient();
      return new Response(new ReadableStream({ cancel: cancelled }));
    });
    const response = await worker.fetch(
      new Request("https://site.test"),
      env,
      ctx(),
    );
    await response.body!.cancel();
    expect(cancelled).toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("closes on a handler failure and propagates it", async () => {
    fetchHandler.mockImplementation(async () => {
      attachClient();
      throw new Error("fixture failure");
    });
    await expect(
      worker.fetch(new Request("https://site.test"), env, ctx()),
    ).rejects.toThrow("fixture failure");
    expect(end).toHaveBeenCalledTimes(1);
  });
  it("closes a bodyless response without waiting for consumption", async () => {
    fetchHandler.mockImplementation(async () => {
      attachClient();
      return new Response(null, { status: 204 });
    });
    expect(
      (await worker.fetch(new Request("https://site.test"), env, ctx())).status,
    ).toBe(204);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
