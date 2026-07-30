type LandingPricingResult = {
  currency: string;
};

export function createLandingPricingCurrencyController(setCurrency: (currency: string) => void) {
  let isActive = true;

  return {
    applyResolvedCurrency(result: LandingPricingResult) {
      if (isActive) {
        setCurrency(result.currency);
      }
    },
    applyFallbackCurrency() {
      if (isActive) {
        setCurrency('USD');
      }
    },
    cleanup() {
      isActive = false;
    },
  };
}
