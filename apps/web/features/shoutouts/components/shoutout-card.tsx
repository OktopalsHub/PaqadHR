"use client";

import { Sparkles } from "lucide-react";
import { MemberAvatar, memberLabel } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import type { Shoutout } from "@/lib/schemas/shoutout";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

function categoryStyle(color?: string | null) {
  if (!color) return undefined;
  if (color.startsWith("#") || color.startsWith("rgb")) {
    return { backgroundColor: `${color}20`, color, borderColor: `${color}40` };
  }
  return undefined;
}

export function ShoutoutCard({ shoutout }: { shoutout: Shoutout }) {
  const recipients = shoutout.recipients.map((r) => memberLabel(r)).join(", ");

  return (
    <article className="culture-card overflow-hidden rounded-xl">
      <div className="flex gap-3 p-4">
        <MemberAvatar member={shoutout.sender} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm leading-snug">
              <span className="font-semibold">{memberLabel(shoutout.sender)}</span>
              <span className="text-muted-foreground"> recognized </span>
              <span className="font-semibold">{recipients}</span>
            </p>
            <span className="culture-points-pill shrink-0">
              +{shoutout.totalPoints} pts
            </span>
          </div>

          {shoutout.categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shoutout.categories.map((category) => (
                <Badge
                  key={category.id}
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0 text-[11px] font-medium",
                    !category.color && "border-primary/20 bg-primary/5 text-primary",
                  )}
                  style={categoryStyle(category.color)}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="culture-message mt-3 rounded-lg px-3 py-2.5 text-sm leading-relaxed">
            {shoutout.message}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary/70" />
            {formatDateTime(shoutout.createdAt)}
          </div>
        </div>
      </div>
    </article>
  );
}
