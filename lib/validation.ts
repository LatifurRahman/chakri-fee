export type ReportInput = {
  organization_name: string;
  role_name: string | null;
  fee_amount: number;
};
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}
export function normalizeOrganization(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{Z}\s]+/gu, " ")
    .trim();
}
function clean(value: unknown, field: string, max: number, required = false) {
  if (typeof value !== "string") {
    if (required) throw new ValidationError(field, "প্রতিষ্ঠানের নাম লিখুন।");
    if (value !== undefined && value !== null)
      throw new ValidationError(field, "সঠিক নাম লিখুন।");
    return "";
  }
  const text = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (required && !text)
    throw new ValidationError(field, "প্রতিষ্ঠানের নাম লিখুন।");
  if (
    text.length > max ||
    /[<>\p{Cc}\p{Cs}\u202A-\u202E\u2066-\u2069]/u.test(text) ||
    (text && !/[\p{L}\p{N}]/u.test(text))
  )
    throw new ValidationError(
      field,
      "সঠিক নাম লিখুন; অপ্রয়োজনীয় চিহ্ন ব্যবহার করবেন না।",
    );
  return text;
}
export function validateReport(value: unknown): ReportInput {
  if (!value || typeof value !== "object")
    throw new ValidationError("form", "সঠিক তথ্য দিন।");
  const v = value as Record<string, unknown>;
  const organization_name = clean(
    v.organization_name,
    "organization_name",
    160,
    true,
  );
  if (!normalizeOrganization(organization_name))
    throw new ValidationError("organization_name", "প্রতিষ্ঠানের নাম লিখুন।");
  if (
    v.fee_amount === "" ||
    v.fee_amount === undefined ||
    v.fee_amount === null
  )
    throw new ValidationError("fee_amount", "আবেদন ফি লিখুন।");
  if (
    typeof v.fee_amount !== "number" &&
    (typeof v.fee_amount !== "string" || !/^\d+$/.test(v.fee_amount))
  )
    throw new ValidationError("fee_amount", "সঠিক টাকার পরিমাণ লিখুন।");
  const fee_amount = Number(v.fee_amount);
  if (
    !Number.isSafeInteger(fee_amount) ||
    fee_amount < 0 ||
    fee_amount > 2147483647
  )
    throw new ValidationError("fee_amount", "সঠিক টাকার পরিমাণ লিখুন।");
  return {
    organization_name,
    fee_amount,
    role_name: clean(v.role_name, "role_name", 120) || null,
  };
}
export function positiveConfig(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}
export const bn = (n: number) =>
  new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 0 }).format(n);
export const money = (n: number) => `৳${bn(n)}`;
