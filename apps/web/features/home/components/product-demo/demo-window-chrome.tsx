import { cn } from '@/lib/utils';

type DemoWindowChromeProps = {
  children: React.ReactNode;
  className?: string;
  url?: string;
};

export function DemoWindowChrome({
  children,
  className,
  url = 'app.paqad.com/acme-hr',
}: DemoWindowChromeProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/10',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2 rounded-full bg-red-400/80" />
          <span className="size-2 rounded-full bg-amber-400/80" />
          <span className="size-2 rounded-full bg-emerald-400/80" />
        </div>
        <span className="truncate text-[10px] text-muted-foreground md:text-xs">{url}</span>
      </div>
      {children}
    </div>
  );
}
