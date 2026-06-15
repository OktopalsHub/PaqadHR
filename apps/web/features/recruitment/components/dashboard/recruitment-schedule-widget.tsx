"use client";

import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { cn } from "@/lib/utils";
import type { ScheduleEvent } from "../../lib/recruitment-types";
import { useTenantHref } from "@/hooks/use-tenant-nav-items";

const TYPE_COLORS: Record<ScheduleEvent["type"], string> = {
  meeting: "border-l-primary bg-primary/5",
  review: "border-l-chart-2 bg-chart-2/10",
  leave: "border-l-chart-3 bg-chart-3/10",
  holiday: "border-l-muted-foreground bg-muted/30",
  celebration: "border-l-chart-4 bg-chart-4/10",
};

type RecruitmentScheduleWidgetProps = {
  events: ScheduleEvent[];
};

export function RecruitmentScheduleWidget({
  events,
}: RecruitmentScheduleWidgetProps) {
  const tenantHref = useTenantHref();

  return (
    <ContentCard
      title="Schedule"
      description="Today"
      action={
        <Link
          href={tenantHref("schedule")}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      }
      bodyClassName="space-y-3"
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events scheduled for today.
        </p>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className={cn(
              "rounded-lg border border-border/60 border-l-4 px-3 py-2.5",
              TYPE_COLORS[event.type],
            )}
          >
            <p className="text-[11px] text-muted-foreground">{event.time}</p>
            <p className="mt-0.5 text-sm font-medium">{event.title}</p>
          </div>
        ))
      )}
    </ContentCard>
  );
}
