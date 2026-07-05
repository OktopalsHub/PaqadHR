'use client';

import { Sparkles } from 'lucide-react';
import { MemberAvatar, memberLabel } from '@/components/member-avatar';
import { Badge } from '@/components/ui/badge';
import { formatPaqPointsDelta } from '@/lib/constants/paq-points';
import { formatDateTime } from '@/lib/format-date';
import type { Shoutout } from '@/lib/schemas/shoutout';
import { renderShoutoutMessage } from '@/lib/shoutouts/render-shoutout-message';
import { cn } from '@/lib/utils';

function categoryStyle(color?: string | null) {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return { backgroundColor: `${color}20`, color, borderColor: `${color}40` };
  }
  return undefined;
}

export function ShoutoutCard({ shoutout }: { shoutout: Shoutout }) {
  const hasRecipients = shoutout.recipients && shoutout.recipients.length > 0;
  const recipients = hasRecipients
    ? shoutout.recipients.map((r) => `${memberLabel(r)} +${r.points}`).join(', ')
    : '';

  return (
    <article className="culture-card overflow-hidden rounded-xl">
      <div className="flex gap-3 p-3">
        <MemberAvatar member={shoutout.sender} className="size-8 text-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs leading-snug">
              <span className="font-semibold">{memberLabel(shoutout.sender)}</span>
              {hasRecipients ? (
                <>
                  <span className="text-muted-foreground"> recognized </span>
                  <span className="font-semibold">{recipients}</span>
                </>
              ) : (
                <span className="text-muted-foreground"> completed a task </span>
              )}
            </p>
            <span className="culture-points-pill shrink-0 text-[10px]">
              {formatPaqPointsDelta(shoutout.totalPoints)}
            </span>
          </div>

          {shoutout.categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shoutout.categories.map((category) => (
                <Badge
                  key={category.id}
                  variant="outline"
                  className={cn(
                    'rounded-full px-2 py-0 text-[10px] font-medium',
                    !category.color && 'border-primary/20 bg-primary/5 text-primary',
                  )}
                  style={categoryStyle(category.color)}
                >
                  {category.name}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="culture-message mt-2 whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed">
            {renderShoutoutMessage(shoutout.message)}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Sparkles className="size-3 text-primary/70" />
            {formatDateTime(shoutout.createdAt)}
          </div>
        </div>
      </div>
    </article>
  );
}
