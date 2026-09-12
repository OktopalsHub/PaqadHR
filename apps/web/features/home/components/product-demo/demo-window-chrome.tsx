import { cn } from '@/lib/utils';

type DemoWindowChromeProps = {
  children: React.ReactNode;
  className?: string;
};

export function DemoWindowChrome({ children, className }: DemoWindowChromeProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/10',
        className,
      )}
    >
      {children}
    </div>
  );
}
