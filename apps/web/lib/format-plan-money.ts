const currencyLocales: Record<string, string> = {
  NGN: 'en-NG',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
};

function maxFractionDigits(currency: string): number {
  return currency.toUpperCase() === 'NGN' ? 0 : 2;
}

export function formatPlanMoney(amount: number, currency: string) {
  const digits = maxFractionDigits(currency);
  try {
    return new Intl.NumberFormat(currencyLocales[currency.toUpperCase()] ?? undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(digits)}`;
  }
}
