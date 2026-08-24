'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

function getInitialsLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function hashColor(input: string): string {
  const palette = [
    '#0ea5e9',
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#14b8a6',
    '#a855f7',
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function generateInitialsSvg(
  name: string,
  options?: { format?: 'data-uri' | 'svg-string'; size?: number },
): string {
  const size = options?.size ?? 48;
  const format = options?.format ?? 'data-uri';
  const initials = getInitialsLabel(name);
  const bg = hashColor(name.toLowerCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img"><rect width="100%" height="100%" rx="${size * 0.2}" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${size * 0.38}" font-weight="600" fill="white">${initials}</text></svg>`;
  if (format === 'svg-string') return svg;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function BankLogo({ name, className }: { name: string; className?: string }) {
  const fallbackLogo = useMemo(
    () => generateInitialsSvg(name, { format: 'data-uri', size: 48 }),
    [name],
  );
  const [src, setSrc] = useState(fallbackLogo);

  useEffect(() => {
    setSrc(fallbackLogo);
  }, [fallbackLogo]);

  return (
    // biome-ignore lint/performance/noImgElement: Inline fallback SVG is rendered without remote fetch.
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
