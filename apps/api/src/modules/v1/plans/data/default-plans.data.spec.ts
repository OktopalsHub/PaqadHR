import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { DEFAULT_PLANS } from './default-plans.data';

describe('DEFAULT_PLANS', () => {
  it('keeps starter aligned with gated feature access', () => {
    const starter = DEFAULT_PLANS.find((plan) => plan.slug === 'starter');

    expect(starter).toBeDefined();
    expect(starter?.features[FeatureAccess.ATTENDANCE]).not.toBe(true);
    expect(starter?.features[FeatureAccess.RECRUITMENT]).not.toBe(true);
    expect(starter?.features[FeatureAccess.ADVANCED_PAYROLL]).not.toBe(true);
  });

  it('keeps growth and scale aligned with gated feature access', () => {
    const growth = DEFAULT_PLANS.find((plan) => plan.slug === 'growth');
    const scale = DEFAULT_PLANS.find((plan) => plan.slug === 'scale');

    expect(growth).toBeDefined();
    expect(scale).toBeDefined();
    expect(growth?.features[FeatureAccess.ATTENDANCE]).toBe(true);
    expect(growth?.features[FeatureAccess.RECRUITMENT]).toBe(true);
    expect(growth?.features[FeatureAccess.ADVANCED_PAYROLL]).not.toBe(true);
    expect(scale?.features[FeatureAccess.ADVANCED_PAYROLL]).toBe(true);
  });
});
