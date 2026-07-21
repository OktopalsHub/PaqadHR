'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type ForceLightThemeProps = {
  children: React.ReactNode;
  className?: string;
};

/** Marketing, auth, and onboarding — always light; restores prior theme on unmount (e.g. dashboard system/dark). */
export function ForceLightTheme({ children, className }: ForceLightThemeProps) {
  const { setTheme } = useTheme();
  const previousTheme = useRef<string | null>(null);

  useEffect(() => {
    previousTheme.current =
      typeof window !== 'undefined' ? (localStorage.getItem('theme') ?? 'system') : 'system';
    setTheme('light');

    return () => {
      setTheme(previousTheme.current ?? 'system');
    };
    // Mount/unmount only — re-running when theme changes would overwrite the saved preference with "light".
  }, [setTheme]);

  return (
    <div className={cn('theme-marketing min-h-screen bg-background text-foreground', className)}>
      {children}
    </div>
  );
}
