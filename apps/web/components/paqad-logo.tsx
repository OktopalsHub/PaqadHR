'use client';

import { brandAssetUrl } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { useBrandMode } from '@/hooks/use-brand-mode';

type PaqadLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function PaqadLogo({ className, showWordmark = true }: PaqadLogoProps) {
  const mode = useBrandMode();
  const variant = showWordmark ? 'lockup' : 'icon';
  const src = brandAssetUrl(variant, mode);

  return (
    // biome-ignore lint/performance/noImgElement: hosted brand asset on paqadhr.com
    <img
      src={src}
      alt="Paqadhr"
      className={cn(showWordmark ? 'h-8 w-auto' : 'size-8 object-contain', className)}
    />
  );
}
