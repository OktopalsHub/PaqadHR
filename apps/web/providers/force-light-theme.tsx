'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type ForceLightThemeProps = {
  children: React.ReactNode;
  className?: string;
};

/** Marketing, auth, and onboarding — always light for now; restores prior theme on unmount (e.g. dashboard system/dark). */
export function ForceLightTheme({ children, className }: ForceLightThemeProps) {
  const { theme, setTheme } = useTheme();
  const previousTheme = useRef<string | undefined>(undefined);

  useEffect(() => {
    previousTheme.current = theme ?? 'system';
    setTheme('light');
    return () => {
      setTheme(previousTheme.current ?? 'system');
    };
    // Only force on mount; restore on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTheme, theme]);

  return (
    <div className={cn('theme-marketing min-h-screen bg-background text-foreground', className)}>
      {children}
    </div>
  );
}
