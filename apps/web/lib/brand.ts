export const BRAND_ORIGIN = 'https://paqadhr.com';

export type BrandMode = 'light' | 'dark';
export type BrandVariant = 'icon' | 'lockup';

export function brandAssetUrl(variant: BrandVariant, mode: BrandMode) {
  return `${BRAND_ORIGIN}/logo-${variant}-${mode}.png`;
}

/** Browser tab / shortcut icons — icon mark only, never the wordmark lockup. */
export const brandFaviconUrls = {
  light: brandAssetUrl('icon', 'light'),
  dark: brandAssetUrl('icon', 'dark'),
} as const;

/** @deprecated Use brandFaviconUrls for metadata icons */
export const brandIconUrls = brandFaviconUrls;
