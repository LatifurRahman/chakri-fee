import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  configured: true,
  origin: true,
  rate: true,
  captcha: true,
  source: true,
}));
const submit = vi.hoisted(() => vi.fn());
vi.mock("../lib/db", () => ({ configured: () => state.configured }));
vi.mock("../lib/db/submit", () => ({ submitReport: submit }));
vi.mock("../lib/security", () => ({
  sameOrigin: () => state.origin,
  anonymousSource: () => {
    if (!state.source) throw new Error("MISSING_SOURCE");
    return "hash";
  },
  rateLimit: async () => state.rate,
  verifyTurnstile: async () => state.captcha,
}));
import { POST } from "../app/api/reports/route";
const req = (body: unknown) =>
  new Request("https://example.test/api/reports", {
    method: "POST",
    body: JSON.stringify(body),
  });
const valid = {
  organization_name: "Bank",
  fee_amount: 500,
  role_name: "Officer",
  anti_spam_token: "token",
};
beforeEach(() => {
  Object.assign(state, {
    configured: true,
    origin: true,
    rate: true,
    captcha: true,
    source: true,
  });
  submit.mockReset();
  submit.mockResolvedValue({
    status: "approved",
    organization_name: "Bank",
    fee_amount: 500,
    role_name: "Officer",
    slug: "bank",
  });
});
describe("submission API regression", () => {
  it("returns only the public success summary and no technical identifiers", async () => {
    const r = await POST(req(valid));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({
      status: "approved",
      organization_name: "Bank",
      fee_amount: 500,
      role_name: "Officer",
      slug: "bank",
    });
    expect(submit).toHaveBeenCalledOnce();
  });
  it("blocks wrong origin before a write", async () => {
    state.origin = false;
    expect((await POST(req(valid))).status).toBe(403);
    expect(submit).not.toHaveBeenCalled();
  });
  it("returns 503 for missing database", async () => {
    state.configured = false;
    expect((await POST(req(valid))).status).toBe(503);
    expect(submit).not.toHaveBeenCalled();
  });
  it.each([null, [], true, "text"])(
    "rejects malformed root %j",
    async (body) => {
      expect((await POST(req(body))).status).toBe(400);
      expect(submit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { organization_name: "" },
    { fee_amount: "" },
    { fee_amount: -1 },
    { fee_amount: 0.5 },
    { fee_amount: 2147483648 },
    { role_name: [] },
  ])("validates bad input %j before writing", async (bad) => {
    expect((await POST(req({ ...valid, ...bad }))).status).toBe(422);
    expect(submit).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and oversized streaming data", async () => {
    expect(
      (
        await POST(
          new Request("https://example.test", { method: "POST", body: "{" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          new Request("https://example.test", {
            method: "POST",
            body: "x".repeat(8193),
          }),
        )
      ).status,
    ).toBe(413);
  });
  it("returns rate-limit status and retry information", async () => {
    state.rate = false;
    const r = await POST(req(valid));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("600");
    expect(submit).not.toHaveBeenCalled();
  });
  it("never writes after failed CAPTCHA", async () => {
    state.captcha = false;
    expect((await POST(req(valid))).status).toBe(400);
    expect(submit).not.toHaveBeenCalled();
  });
  it("fails closed for an absent trusted source", async () => {
    state.source = false;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(req(valid))).status).toBe(503);
      expect(submit).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it("does not disclose database errors or form contents", async () => {
    submit.mockRejectedValue(new Error("SECRET database password"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await POST(req(valid));
      expect(r.status).toBe(503);
      expect(JSON.stringify(await r.json())).not.toContain("SECRET");
      expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
      expect(JSON.stringify(log.mock.calls)).not.toContain("Officer");
    } finally {
      log.mockRestore();
    }
  });
});
