export function advanceBillingPeriod(anchor: Date) {
  const s = new Date(anchor);
  const e = new Date(s);
  e.setMonth(e.getMonth() + 1);
  return { periodStart: s, periodEnd: e };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID.test(value);
}
