'use client';

import { generateInitialsSvg, getBankByName, getBankLogo } from '@theonlyrasheed/bank-logos';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export function fallbackSafeBankName(name: string): string {
  // The logo library interpolates derived initials into SVG XML. Replacing
  // XML-reserved characters before it derives those initials keeps the data
  // URI valid for names such as "A & B Bank".
  return name.replace(/[&<>'"]/g, ' ');
}

export function BankLogo({ name, className }: { name: string; className?: string }) {
  const bank = useMemo(() => getBankByName(name), [name]);
  const fallbackName = useMemo(() => fallbackSafeBankName(bank?.name ?? name), [bank?.name, name]);
  const fallbackLogo = useMemo(
    () => generateInitialsSvg(fallbackName, { format: 'data-uri', size: 48 }),
    [fallbackName],
  );
  const remoteLogo = useMemo(() => (bank?.hasCustomLogo ? getBankLogo(bank) : null), [bank]);
  const [src, setSrc] = useState(fallbackLogo);

  useEffect(() => {
    setSrc(fallbackLogo);
    if (!remoteLogo) return;

    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setSrc(remoteLogo);
    };
    image.src = remoteLogo;

    return () => {
      active = false;
    };
  }, [fallbackLogo, remoteLogo]);

  return (
    // biome-ignore lint/performance/noImgElement: The library resolves third-party bank-logo URLs after the inline fallback is displayed.
    <img
      alt=""
      aria-hidden="true"
      className={cn(
        'size-6 shrink-0 rounded-md border border-slate-200/80 bg-white object-contain p-0.5',
        className,
      )}
      src={src}
    />
  );
}
