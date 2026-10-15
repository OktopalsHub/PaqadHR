const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  bonus: 'Bonus',
  allowance: 'Allowance',
  overtime: 'Overtime',
  commission: 'Commission',
  deduction: 'Deduction',
  penalty: 'Penalty',
};

export type AdjustmentLineForDisplay = {
  type: string;
  method: 'fixed_amount' | 'percentage' | string;
  value: number;
  reason?: string | null;
};

export function adjustmentTypeLabel(type: string): string {
  const key = type.trim().toLowerCase();
  return ADJUSTMENT_TYPE_LABELS[key] ?? type.charAt(0).toUpperCase() + type.slice(1);
}

/** e.g. "Bonus · NGN 5,000 · Q3 performance" */
export function formatAdjustmentLineLabel(
  line: AdjustmentLineForDisplay,
  currency: string,
): string {
  const type = adjustmentTypeLabel(line.type);
  const amount =
    line.method === 'percentage'
      ? `${Number(line.value).toLocaleString('en-US')}%`
      : `${currency} ${Number(line.value).toLocaleString('en-US')}`;
  const reason = line.reason?.trim();
  return reason ? `${type} · ${amount} · ${reason}` : `${type} · ${amount}`;
}
