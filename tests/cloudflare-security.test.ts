import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { workerRequestContext } from "../lib/db/context";
import { anonymousSource, digest } from "../lib/security";
import { configured, db } from "../lib/db";
afterEach(() => vi.unstubAllEnvs());
describe("Workers request context", () => {
  it("uses Cloudflare's source header and ignores spoofed forwarding headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTI_ABUSE_SECRET", "a".repeat(32));
    workerRequestContext.run({ connectionString: "fixture" }, () => {
      const request = new Request("https://site.test", {
        headers: {
          "cf-connecting-ip": "2001:db8::1",
          "x-real-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
        },
      });
      expect(anonymousSource(request)).toBe(
        digest(`${new Date().toISOString().slice(0, 10)}:2001:db8::1`),
      );
    });
    expect(workerRequestContext.getStore()).toBeUndefined();
  });
  it.each(["", "not-an-ip", "1.2.3.4, 5.6.7.8"])(
    "fails closed for invalid Cloudflare header %j",
    (ip) => {
      workerRequestContext.run({ connectionString: "fixture" }, () => {
        expect(() =>
          anonymousSource(
            new Request("https://site.test", {
              headers: { "cf-connecting-ip": ip, "x-real-ip": "127.0.0.1" },
            }),
          ),
        ).toThrow("TRUSTED_SOURCE_HEADER_MISSING");
      });
    },
  );
  it("isolates concurrent request contexts and reuses only each request's client", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(configured()).toBe(false);
    const scopes = [
      { connectionString: "postgresql://localhost:5432/test" },
      { connectionString: "postgresql://localhost:5432/test" },
    ];
    const clients = await Promise.all(
      scopes.map((scope) =>
        workerRequestContext.run(scope, async () => {
          expect(configured()).toBe(true);
          const client = db();
          await Promise.resolve();
          expect(db()).toBe(client);
          return client;
        }),
      ),
    );
    expect(clients[0]).not.toBe(clients[1]);
    for (const client of clients) {
      expect(client.options.prepare).toBe(true);
      expect(client.options.fetch_types).toBe(false);
      await client.end();
    }
    expect(configured()).toBe(false);
  });
});
