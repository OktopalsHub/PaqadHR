import { cn } from '@/lib/utils';

type PaqadLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function PaqadLogo({ className, showWordmark = true }: PaqadLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        P
      </span>
      {showWordmark ? <span className="text-sm font-semibold tracking-tight">Paqad</span> : null}
    </span>
  );
}
