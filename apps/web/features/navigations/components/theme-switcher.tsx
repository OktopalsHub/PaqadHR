'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Laptop, label: 'System' },
] as const;

export function ThemeMenuRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? (theme ?? 'system') : 'system';

  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
      <div className="flex items-center gap-1 px-2 pb-2">
        {THEMES.map(({ value, icon: Icon, label }) => {
          const selected = activeTheme === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={selected}
              className={cn(
                'flex size-8 items-center justify-center rounded-md transition-colors',
                selected
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setTheme(value)}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </>
  );
}
