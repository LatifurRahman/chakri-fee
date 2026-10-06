import { describe, it, expect } from "vitest";
import {
  normalizeOrganization,
  validateReport,
  positiveConfig,
} from "../lib/validation";
import { median, statistics } from "../lib/statistics";
describe("organization normalization", () => {
  it("normalizes casing, whitespace and punctuation", () => {
    expect(normalizeOrganization("  Bangladesh   Bank. ")).toBe(
      "bangladesh bank",
    );
  });
  it("preserves Bengali letters and does not guess semantic equivalence", () => {
    expect(normalizeOrganization(" বাংলাদেশ ব্যাংক ")).toBe("বাংলাদেশ ব্যাংক");
    expect(normalizeOrganization("বাংলাদেশ ব্যাংক")).not.toBe(
      normalizeOrganization("Bangladesh Bank"),
    );
  });
});
describe("fee validation", () => {
  it("accepts integers including zero and Bangla organizations", () => {
    expect(
      validateReport({ organization_name: "বাংলাদেশ ব্যাংক", fee_amount: "0" })
        .fee_amount,
    ).toBe(0);
  });
  it.each([-1, 1.2, Infinity, NaN, 2147483648, "1e3", "hello", "", null])(
    "rejects malformed fees %s",
    (fee_amount) => {
      expect(() =>
        validateReport({ organization_name: "Bank", fee_amount }),
      ).toThrow();
    },
  );
  it("requires organization and retains large but representable fees for moderation", () => {
    expect(() =>
      validateReport({ organization_name: " ", fee_amount: 500 }),
    ).toThrow();
    expect(
      validateReport({ organization_name: "Bank", fee_amount: 999999999 })
        .fee_amount,
    ).toBe(999999999);
  });
  it.each([
    "<script>alert(1)</script>",
    "😀",
    "Bank\u202Eevil",
    "a".repeat(161),
    "Bank\u0000",
  ])("rejects abusive organization names", (organization_name) => {
    expect(() =>
      validateReport({ organization_name, fee_amount: 500 }),
    ).toThrow();
  });
  it("validates optional roles and does not strip valid Unicode", () => {
    expect(
      validateReport({
        organization_name: "Bank",
        fee_amount: 500,
        role_name: "সহকারী পরিচালক",
      }).role_name,
    ).toBe("সহকারী পরিচালক");
    expect(() =>
      validateReport({
        organization_name: "Bank",
        fee_amount: 500,
        role_name: "<img>",
      }),
    ).toThrow();
  });
  it("configuration is bounded to positive integers", () => {
    expect(positiveConfig("-2", 5)).toBe(5);
    expect(positiveConfig("6", 5)).toBe(6);
  });
});
describe("statistics", () => {
  it("calculates odd and even medians without mutating inputs", () => {
    const a = [700, 200, 500];
    expect(median(a)).toBe(500);
    expect(a).toEqual([700, 200, 500]);
    expect(median([500, 200])).toBe(350);
    expect(median([])).toBe(0);
  });
  it("excludes every unapproved status and counts distinct organizations", () => {
    const rows = [
      { organization_id: "a", fee_amount: 200, status: "approved" },
      { organization_id: "a", fee_amount: 500, status: "approved" },
      { organization_id: "b", fee_amount: 800, status: "approved" },
      ...["flagged", "pending", "rejected"].map((status) => ({
        organization_id: "c",
        fee_amount: 999999,
        status,
      })),
    ];
    expect(statistics(rows)).toEqual({
      count: 3,
      total: 1500,
      mean: 500,
      median: 500,
      organizations: 2,
    });
  });
});
