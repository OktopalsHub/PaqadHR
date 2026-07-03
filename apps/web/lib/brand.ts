export const BRAND_ORIGIN = 'https://paqadhr.com';

export type BrandMode = 'light' | 'dark';
export type BrandVariant = 'icon' | 'lockup';

export function brandAssetUrl(variant: BrandVariant, mode: BrandMode) {
  return `${BRAND_ORIGIN}/logo-${variant}-${mode}.png`;
}
