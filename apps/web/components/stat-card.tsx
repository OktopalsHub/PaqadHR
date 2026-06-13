import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: { value: string; positive?: boolean };
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClassName,
  trend,
  className,
}: StatCardProps) {
  return (
    <article
      className={cn(
        "app-card group rounded-xl p-4 transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
            iconClassName,
          )}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            trend.positive ? "text-primary" : "text-muted-foreground",
          )}
        >
          {trend.value}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </article>
  );
}
