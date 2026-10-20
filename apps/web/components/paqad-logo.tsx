'use client';

import { useBrandMode } from '@/hooks/use-brand-mode';
import { brandAssetUrl } from '@/lib/brand';
import { cn } from '@/lib/utils';

type PaqadLogoProps = {
  className?: string;
  showWordmark?: boolean;
  priority?: boolean;
};

export function PaqadLogo({ className, showWordmark = true, priority = false }: PaqadLogoProps) {
  const mode = useBrandMode();
  const variant = showWordmark ? 'lockup' : 'icon';
  const src = brandAssetUrl(variant, mode);

  return (
    // biome-ignore lint/performance/noImgElement: brand assets served from pub-aa92a7d639fd40aab9505685d7e75215.r2.dev
    <img
      src={src}
      alt="Paqadhr"
      width={showWordmark ? 357 : 58}
      height={67}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn(showWordmark ? 'h-8 w-auto' : 'size-8 object-contain', className)}
    />
  );
}
