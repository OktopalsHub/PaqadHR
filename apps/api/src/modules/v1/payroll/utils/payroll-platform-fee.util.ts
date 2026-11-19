const MONEY_SCALE = 12n;
const MONEY_FACTOR = 10n ** MONEY_SCALE;
const CENT_UNITS = MONEY_FACTOR / 100n;

export function calculatePayrollPlatformFee(amount: string, percentage: number): string | null {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
  const units = parseMoneyUnits(amount);
  if (units === null) return null;

  const percentageUnits = BigInt(Math.round(percentage * 1_000_000));
  const rawFeeUnits = (units * percentageUnits) / 100_000_000n;
  const roundedCents = ((rawFeeUnits + CENT_UNITS / 2n) / CENT_UNITS) * CENT_UNITS;
  return formatMoneyUnits(roundedCents);
}

export function addMoneyAmounts(left: string, right: string): string | null {
  const leftUnits = parseMoneyUnits(left);
  const rightUnits = parseMoneyUnits(right);
  if (leftUnits === null || rightUnits === null) return null;
  return formatMoneyUnits(leftUnits + rightUnits);
}

export function sumMoneyAmounts(values: string[]): string | null {
  let total = 0n;
  for (const value of values) {
    const units = parseMoneyUnits(value);
    if (units === null) return null;
    total += units;
  }
  return formatMoneyUnits(total);
}

export function multiplyMoneyByRate(amount: string, rate: string, precision = 6): string | null {
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) return null;
  const amountUnits = parseMoneyUnits(amount);
  const rateUnits = parseMoneyUnits(rate);
  if (amountUnits === null || rateUnits === null) return null;
  const rawUnits = (amountUnits * rateUnits + MONEY_FACTOR / 2n) / MONEY_FACTOR;
  const precisionFactor = 10n ** BigInt(12 - precision);
  const roundedUnits = ((rawUnits + precisionFactor / 2n) / precisionFactor) * precisionFactor;
  return formatMoneyUnits(roundedUnits);
}

function parseMoneyUnits(value: string): bigint | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * MONEY_FACTOR + BigInt(fraction.padEnd(Number(MONEY_SCALE), '0'));
}

function formatMoneyUnits(value: bigint): string {
  const whole = value / MONEY_FACTOR;
  const fraction = (value % MONEY_FACTOR)
    .toString()
    .padStart(Number(MONEY_SCALE), '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
