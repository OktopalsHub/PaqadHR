import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ContentCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ContentCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: ContentCardProps) {
  return (
    <section
      className={cn(
        "app-card flex flex-col overflow-hidden rounded-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
