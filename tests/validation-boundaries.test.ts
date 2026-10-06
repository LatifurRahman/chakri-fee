import { describe, it, expect } from "vitest";
import { validateReport, normalizeOrganization } from "../lib/validation";
const base = { organization_name: "Bangladesh Bank", fee_amount: 500 };
describe("validation boundaries and normalization invariants", () => {
  it.each([0, 1, 10000, 10001, 2147483647])(
    "accepts representable integer %s without changing it",
    (fee_amount) =>
      expect(validateReport({ ...base, fee_amount }).fee_amount).toBe(
        fee_amount,
      ),
  );
  it.each([
    true,
    false,
    [],
    {},
    " 500",
    "500 ",
    "0.5",
    "-0",
    "Infinity",
    "0x10",
  ])("rejects wrong fee types/formats %j", (fee_amount) =>
    expect(() => validateReport({ ...base, fee_amount })).toThrow(),
  );
  it.each([0, true, [], {}])(
    "rejects malformed optional role %j",
    (role_name) =>
      expect(() => validateReport({ ...base, role_name })).toThrow(),
  );
  it.each([undefined, null, "", "  "])(
    "accepts absent/blank role %j",
    (role_name) =>
      expect(validateReport({ ...base, role_name }).role_name).toBeNull(),
  );
  it("accepts maximum organization and role lengths, rejects the next length", () => {
    expect(
      validateReport({
        ...base,
        organization_name: "a".repeat(160),
        role_name: "b".repeat(120),
      }).role_name,
    ).toHaveLength(120);
    expect(() =>
      validateReport({ ...base, role_name: "b".repeat(121) }),
    ).toThrow();
  });
  it.each([
    "Bank",
    " বাংলাদেশ ব্যাংক ",
    "BANK. LTD",
    "Ｆｕｌｌｗｉｄｔｈ Bank",
    "Bank—PLC",
    "Bank   Bank",
  ])("normalization is idempotent for %s", (name) =>
    expect(normalizeOrganization(normalizeOrganization(name))).toBe(
      normalizeOrganization(name),
    ),
  );
  it.each(["Bank\ud800", "Bank\udfff", "Bank\u2067text", "Bank\u0000"])(
    "rejects malformed Unicode %j",
    (organization_name) =>
      expect(() => validateReport({ ...base, organization_name })).toThrow(),
  );
});
