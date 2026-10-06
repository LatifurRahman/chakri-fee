export function median(values: number[]) {
  if (!values.length) return 0;
  const a = [...values].sort((a, b) => a - b);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function statistics(
  rows: { fee_amount: number; status: string; organization_id: string }[],
) {
  const a = rows.filter((r) => r.status === "approved");
  const total = a.reduce((s, r) => s + r.fee_amount, 0);
  return {
    count: a.length,
    total,
    mean: a.length ? total / a.length : 0,
    median: median(a.map((r) => r.fee_amount)),
    organizations: new Set(a.map((r) => r.organization_id)).size,
  };
}
