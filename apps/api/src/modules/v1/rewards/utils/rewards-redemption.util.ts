/** Flat fee applies only when converted face value is at least this amount (rewards currency). */
export const REDEMPTION_FLAT_FEE_MIN_AMOUNT = 2000;

export function computeRedemptionDebit(
  convertedValue: number,
  feePercentage: number,
  flatFee: number,
): number {
  const markup = convertedValue * (1 + feePercentage / 100);
  const flat = convertedValue >= REDEMPTION_FLAT_FEE_MIN_AMOUNT ? flatFee : 0;
  return markup + flat;
}
