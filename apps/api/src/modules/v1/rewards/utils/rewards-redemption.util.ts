/** Wallet debit for a redemption face value (percentage markup only). */
export function computeRedemptionDebit(convertedValue: number, feePercentage: number): number {
  return convertedValue * (1 + feePercentage / 100);
}

export function computeTremendousPointsCost(
  wholesaleInRewardsCurrency: number,
  feePercentage: number,
  pointsExchangeRate: number,
): number {
  return Math.ceil(computeRedemptionDebit(wholesaleInRewardsCurrency, feePercentage) * pointsExchangeRate);
}
