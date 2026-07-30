export function clampOnboardingStep(step: number, stepCount: number): number {
  if (!Number.isFinite(step) || stepCount <= 0) {
    return 0;
  }

  const normalizedStep = Math.trunc(step);
  return Math.min(Math.max(normalizedStep, 0), stepCount - 1);
}
