const currencyLocales: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
};

export function formatPlanMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(currencyLocales[currency] ?? undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
