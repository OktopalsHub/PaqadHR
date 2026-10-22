'use client';

import Image from 'next/image';
import { useBrandMode } from '@/hooks/use-brand-mode';
import { brandAssetUrl } from '@/lib/brand';
import { cn } from '@/lib/utils';

type PaqadLogoProps = {
  className?: string;
  showWordmark?: boolean;
  /** Above-the-fold logos preload; everything else lazy-loads. */
  priority?: boolean;
};

/** Natural pixel size of the brand assets served from R2. */
const LOGO_WIDTH = 357;
const LOGO_HEIGHT = 67;
const ICON_WIDTH = 58;
const ICON_HEIGHT = 67;

/** Rendered size: the lockup is `h-8` tall (171px wide), the mark is `size-8`. */
const LOCKUP_SIZES = '192px';
const ICON_SIZES = '32px';

export function PaqadLogo({ className, showWordmark = true, priority = false }: PaqadLogoProps) {
  const mode = useBrandMode();
  const variant = showWordmark ? 'lockup' : 'icon';
  const src = brandAssetUrl(variant, mode);

  return (
    <Image
      src={src}
      alt="Paqadhr"
      width={showWordmark ? LOGO_WIDTH : ICON_WIDTH}
      height={showWordmark ? LOGO_HEIGHT : ICON_HEIGHT}
      sizes={showWordmark ? LOCKUP_SIZES : ICON_SIZES}
      // `priority` is deprecated in Next 16; `preload` is the explicit replacement.
      preload={priority}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn(showWordmark ? 'h-8 w-auto' : 'size-8 object-contain', className)}
    />
  );
}
