'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_BRAND_COLOR, readBrandColor } from '@/lib/theme-colors';

export function useBrandColor() {
  const [color, setColor] = useState(DEFAULT_BRAND_COLOR);

  useEffect(() => {
    setColor(readBrandColor());
  }, []);

  return color;
}
