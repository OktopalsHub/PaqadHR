import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeroProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

export function PageHero({
  icon: Icon,
  title,
  description,
  className,
}: PageHeroProps) {
  return (
    <section className={cn("culture-hero rounded-xl px-5 py-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
