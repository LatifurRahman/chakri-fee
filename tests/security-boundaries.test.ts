import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  anonymousSource,
  digest,
  createSession,
  validSession,
  verifyTurnstile,
  sameOrigin,
} from "../lib/security";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("source and session boundaries", () => {
  it("uses valid trusted IPv4/IPv6 without retaining raw addresses", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTI_ABUSE_SECRET", "a".repeat(32));
    for (const ip of ["127.0.0.1", "2001:db8::1"]) {
      const hash = anonymousSource(
        new Request("https://site.test", { headers: { "x-real-ip": ip } }),
      );
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toContain(ip);
    }
  });
  it.each(["", "not-an-ip", "1.2.3.4, 5.6.7.8"])(
    "rejects malformed trusted source %j",
    (ip) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(() =>
        anonymousSource(
          new Request("https://site.test", { headers: { "x-real-ip": ip } }),
        ),
      ).toThrow();
    },
  );
  it("does not trust forwarded-for in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() =>
      anonymousSource(
        new Request("https://site.test", {
          headers: { "x-forwarded-for": "127.0.0.1" },
        }),
      ),
    ).toThrow();
  });
  it("rotates source hashes daily and isolates addresses", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTI_ABUSE_SECRET", "a".repeat(32));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const r = new Request("https://site.test", {
      headers: { "x-real-ip": "127.0.0.1" },
    });
    const first = anonymousSource(r);
    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    expect(anonymousSource(r)).not.toBe(first);
  });
  it("fails without a strong HMAC secret", () => {
    vi.stubEnv("ANTI_ABUSE_SECRET", "short");
    expect(() => digest("input")).toThrow();
  });
  it("rejects a session exactly at expiry and after secret rotation", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "a".repeat(32));
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const token = createSession();
    expect(validSession(token)).toBe(true);
    vi.setSystemTime(100000 + 8 * 60 * 60 * 1000);
    expect(validSession(token)).toBe(false);
    vi.setSystemTime(100000);
    vi.stubEnv("ADMIN_SESSION_SECRET", "b".repeat(32));
    expect(validSession(token)).toBe(false);
  });
  it("fails closed with an invalid configured origin", () => {
    vi.stubEnv("SITE_URL", "invalid");
    expect(
      sameOrigin(
        new Request("https://site.test", {
          headers: { origin: "https://site.test" },
        }),
      ),
    ).toBe(false);
  });
});
describe("CAPTCHA outage and token boundaries", () => {
  it.each([undefined, null, 5, {}, "", " ", "t".repeat(2049)])(
    "rejects invalid token %j",
    async (token) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test");
      vi.stubEnv("TURNSTILE_HOSTNAME", "site.test");
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect(await verifyTurnstile(token)).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["network", "http", "json", "null"])(
    "fails closed on verification %s failure",
    async (mode) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test");
      vi.stubEnv("TURNSTILE_HOSTNAME", "site.test");
      const fetch = vi.fn();
      if (mode === "network") fetch.mockRejectedValue(new Error("timeout"));
      else
        fetch.mockResolvedValue({
          ok: mode !== "http",
          json: async () => {
            if (mode === "json") throw new Error("bad JSON");
            return null;
          },
        });
      vi.stubGlobal("fetch", fetch);
      expect(await verifyTurnstile("token")).toBe(false);
    },
  );
});
