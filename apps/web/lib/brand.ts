export const BRAND_ORIGIN = 'https://pub-aa92a7d639fd40aab9505685d7e75215.r2.dev';

export type BrandMode = 'light' | 'dark';
export type BrandVariant = 'icon' | 'lockup';

export function brandAssetUrl(variant: BrandVariant, mode: BrandMode) {
  return `${BRAND_ORIGIN}/logo-${variant}-${mode}.png`;
}

/** Browser tab / shortcut icons — Paqad mark only. */
export const brandFaviconUrls = {
  light: brandAssetUrl('icon', 'light'),
  dark: brandAssetUrl('icon', 'dark'),
} as const;

/** @deprecated Use brandFaviconUrls for metadata icons */
export const brandIconUrls = brandFaviconUrls;
