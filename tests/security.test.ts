import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createSession,
  validSession,
  passwordHash,
  validPassword,
  sameOrigin,
} from "../lib/security";
describe("admin security", () => {
  it("signs sessions, rejects tampering and malformed tokens", () => {
    process.env.ADMIN_SESSION_SECRET =
      "test-secret-at-least-thirty-two-characters";
    const token = createSession();
    expect(validSession(token)).toBe(true);
    expect(validSession(token + "a")).toBe(false);
    expect(validSession("0.fake.fake")).toBe(false);
    expect(validSession(undefined)).toBe(false);
  });
  it("verifies salted password hashes", () => {
    process.env.ADMIN_PASSWORD_HASH = passwordHash("test-strong-password");
    expect(validPassword("test-strong-password")).toBe(true);
    expect(validPassword("incorrect")).toBe(false);
  });
  it("rejects cross-origin and missing-origin mutations", () => {
    process.env.SITE_URL = "https://example.test";
    expect(
      sameOrigin(
        new Request("https://example.test/api", {
          headers: { origin: "https://example.test" },
        }),
      ),
    ).toBe(true);
    expect(
      sameOrigin(
        new Request("https://example.test/api", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    ).toBe(false);
    expect(sameOrigin(new Request("https://example.test/api"))).toBe(false);
  });
});

describe("Turnstile verification", () => {
  it("cannot use the development bypass in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_BYPASS_TURNSTILE", "true");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    try {
      const { verifyTurnstile } = await import("../lib/security");
      expect(await verifyTurnstile("")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("requires success, the configured hostname and the fee-report action", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    vi.stubEnv("TURNSTILE_HOSTNAME", "example.test");
    try {
      const { verifyTurnstile } = await import("../lib/security");
      for (const [result, expected] of [
        [
          { success: true, hostname: "example.test", action: "fee-report" },
          true,
        ],
        [
          { success: false, hostname: "example.test", action: "fee-report" },
          false,
        ],
        [{ success: true, hostname: "evil.test", action: "fee-report" }, false],
        [{ success: true, hostname: "example.test", action: "login" }, false],
      ] as const) {
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({ json: async () => result }),
        );
        expect(await verifyTurnstile("token")).toBe(expected);
      }
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
