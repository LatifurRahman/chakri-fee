import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readJson, HttpError } from "../lib/http";
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test", { method: "POST", body, headers });
describe("bounded JSON request reader", () => {
  it("accepts a valid object at the exact byte limit", async () => {
    const body = JSON.stringify({ name: "বাংলাদেশ" });
    expect(await readJson(request(body), Buffer.byteLength(body))).toEqual({
      name: "বাংলাদেশ",
    });
  });
  it.each(["null", "[]", "true", "123", '"text"', "{invalid", ""])(
    "rejects invalid/non-object JSON %s",
    async (body) => {
      await expect(readJson(request(body), 100)).rejects.toMatchObject({
        status: 400,
      });
    },
  );
  it("rejects declared oversized data before reading", async () => {
    await expect(
      readJson(request("{}", { "content-length": "10000" }), 100),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("counts UTF-8 bytes rather than characters", async () => {
    await expect(
      readJson(request('{"name":"বাংলাদেশ"}'), 20),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("ignores forged small length and cancels an oversized stream", async () => {
    let cancelled = false;
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        sent++;
        c.enqueue(new Uint8Array(80));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request("https://example.test", {
      method: "POST",
      headers: { "content-length": "1" },
      body,
      duplex: "half",
    } as RequestInit);
    await expect(readJson(req, 100)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(5);
  });
  it("rejects malformed UTF-8", async () => {
    const req = new Request("https://example.test", {
      method: "POST",
      body: new Uint8Array([0xff]),
    });
    await expect(readJson(req, 100)).rejects.toBeInstanceOf(HttpError);
  });
  it("rejects a missing body", async () => {
    await expect(
      readJson(new Request("https://example.test", { method: "POST" }), 100),
    ).rejects.toMatchObject({ status: 400 });
  });
});
