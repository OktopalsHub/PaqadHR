import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatPaqPointsDelta } from '@/lib/constants/paq-points';
import { demoShoutouts } from '../../../constants/landing-demo-data';

type ShoutoutsDemoViewProps = {
  compact?: boolean;
};

export function ShoutoutsDemoView({ compact }: ShoutoutsDemoViewProps) {
  return (
    <div className={cn('space-y-4 p-4', compact && 'p-3')}>
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-4">
        <p className="text-xs font-medium text-muted-foreground">Give a shoutout</p>
        <div className="mt-2 h-16 rounded-lg border border-border/50 bg-background/60" />
        <p className="mt-2 text-[10px] text-muted-foreground">
          Slack connected · posts to #shoutouts
        </p>
      </div>

      <div className="space-y-3">
        {demoShoutouts.map((shoutout) => (
          <article
            key={shoutout.id}
            className="rounded-xl border border-border/60 bg-card p-3 shadow-sm"
          >
            <div className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-foreground">
                {shoutout.senderInitials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs leading-snug">
                    <span className="font-semibold">{shoutout.sender}</span>
                    <span className="text-muted-foreground"> recognized </span>
                    <span className="font-semibold">{shoutout.recipients}</span>
                  </p>
                  <span className="culture-points-pill shrink-0 text-[10px]">
                    {formatPaqPointsDelta(shoutout.points)}
                  </span>
                </div>
                {shoutout.category ? (
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {shoutout.category}
                  </Badge>
                ) : null}
                <div className="culture-message mt-2 rounded-lg px-3 py-2 text-xs leading-relaxed">
                  {shoutout.message}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Sparkles className="size-3 text-primary/70" />
                  {shoutout.timeAgo}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
