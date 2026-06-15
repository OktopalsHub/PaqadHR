"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContentCard } from "@/components/content-card";
import { formatDistanceToNow } from "date-fns";
import type { ActivityItem } from "../../lib/recruitment-types";

type RecruitmentActivityFeedProps = {
  items: ActivityItem[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function RecruitmentActivityFeed({ items }: RecruitmentActivityFeedProps) {
  return (
    <ContentCard title="Recent activity" bodyClassName="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Activity will appear here as your team works in Recruitment.
        </p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-muted text-[10px] font-medium">
                {initials(item.actor)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{item.actor}</span>{" "}
                <span className="text-muted-foreground">{item.action}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(item.occurredAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))
      )}
    </ContentCard>
  );
}
