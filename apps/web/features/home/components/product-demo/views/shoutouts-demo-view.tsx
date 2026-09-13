import { Heart, Sparkles } from 'lucide-react';
import { formatPaqPointsDelta } from '@/lib/constants/paq-points';
import { cn } from '@/lib/utils';
import { demoShoutouts } from '../../../constants/landing-demo-data';

type ShoutoutsDemoViewProps = {
  compact?: boolean;
};

export function ShoutoutsDemoView({ compact }: ShoutoutsDemoViewProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 bg-[#fbfdfc] p-4 font-montserrat dark:bg-[#0d1e19]',
        compact && 'p-3',
      )}
    >
      <div className="rounded-xl border border-[#d9eae3] bg-[#f1faf6] p-3.5 dark:border-[#2c6352] dark:bg-[#12342a]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Heart className="size-3.5" fill="currentColor" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">Celebrate someone</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                A little recognition goes a long way.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#bde3d3] bg-white px-2 py-1 text-[10px] font-medium text-[#377a63] dark:border-[#3b7b65] dark:bg-[#1a4537] dark:text-[#9de2c6]">
            + Paq points
          </span>
        </div>
        {!compact ? (
          <div className="mt-3 flex items-center rounded-lg border border-[#dbe9e3] bg-white px-3 py-2.5 text-[11px] text-[#7b8883] dark:border-[#2d584a] dark:bg-[#173128] dark:text-[#9bb5aa]">
            Thank a teammate for something great…
          </div>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {demoShoutouts.map((shoutout, index) => (
          <article
            key={shoutout.id}
            className="rounded-xl border border-[#e2ebe7] bg-white p-3.5 shadow-[0_8px_20px_-18px_rgba(23,60,50,0.5)] dark:border-[#25453a] dark:bg-[#132720]"
          >
            <div className="flex gap-3">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  index === 0 ? 'bg-[#dff2ea] text-[#286d56]' : 'bg-[#eee6fb] text-[#72549c]'
                }`}
              >
                {shoutout.senderInitials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs leading-snug text-foreground">
                    <span className="font-semibold">{shoutout.sender}</span>
                    <span className="text-muted-foreground"> recognised </span>
                    <span className="font-semibold">{shoutout.recipients}</span>
                  </p>
                  <span className="shrink-0 rounded-full border border-[#b9e3d2] bg-[#effaf5] px-2 py-0.5 text-[10px] font-semibold text-[#287256]">
                    {formatPaqPointsDelta(shoutout.points)}
                  </span>
                </div>
                <div className="mt-2.5 rounded-lg bg-[#f7faf8] px-3 py-2 text-xs leading-relaxed text-[#394841] dark:bg-[#173128] dark:text-[#d1e1da]">
                  {shoutout.message}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Sparkles className="size-3 text-primary/70" />
                  <span>{shoutout.category ?? 'Recognition'}</span>
                  <span aria-hidden>·</span>
                  <span>{shoutout.timeAgo}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
