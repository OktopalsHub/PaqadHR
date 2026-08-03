'use client';

import { format } from 'date-fns';
import { PersonAvatar } from '@/components/person-avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TenantActivity } from '@/lib/api/activities';
import { cn } from '@/lib/utils';
import {
  formatActivityActor,
  getActivityChangeEntries,
  getActivityDetailEntries,
  getActivityPresentation,
} from '../lib/activity-format';

type ActivityDetailDialogProps = {
  activity: TenantActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ChangesTable({
  entries,
}: {
  entries: Array<{ field: string; from: string; to: string }>;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[8px] border border-border/70">
      <p className="border-b border-border/70 bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        What changed
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-slate-500">
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Before</th>
              <th className="px-3 py-2 font-medium">After</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.field} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2.5 align-top text-xs font-medium text-slate-600 dark:text-slate-300">
                  {entry.field}
                </td>
                <td className="px-3 py-2.5 align-top break-words text-xs text-rose-700/90 dark:text-rose-300 whitespace-pre-wrap">
                  {entry.from}
                </td>
                <td className="px-3 py-2.5 align-top break-words text-xs text-emerald-700/90 dark:text-emerald-300 whitespace-pre-wrap">
                  {entry.to}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ActivityDetailDialog({ activity, open, onOpenChange }: ActivityDetailDialogProps) {
  if (!activity) return null;

  const { icon: Icon, iconClassName, title } = getActivityPresentation(activity);
  const actor = formatActivityActor(activity.actorName, activity.actorMemberId);
  const when = format(new Date(activity.createdAt), 'PPpp');
  const failed = activity.status?.toLowerCase() === 'failed';
  const changeEntries = getActivityChangeEntries(activity);
  const detailEntries = getActivityDetailEntries(activity);
  const hasDiff = changeEntries.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-white/60 shadow-sm',
                iconClassName,
                failed && 'border-destructive/15 bg-destructive/10 text-destructive',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left text-base leading-snug">{title}</DialogTitle>
              <DialogDescription className="text-left">
                {hasDiff
                  ? `${changeEntries.length} field${changeEntries.length === 1 ? '' : 's'} changed`
                  : 'Workspace activity details'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <PersonAvatar
                src={activity.actorAvatarUrl}
                name={actor}
                className="size-6 border border-border/60"
                fallbackClassName="text-[10px] font-semibold"
              />
              <span>
                <span className="text-xs font-normal text-slate-500">Changed by </span>
                {actor}
              </span>
            </span>
            <time dateTime={activity.createdAt} className="text-slate-500 dark:text-slate-400">
              {when}
            </time>
            {failed ? <span className="font-semibold text-destructive">Failed</span> : null}
          </div>

          {hasDiff ? <ChangesTable entries={changeEntries} /> : null}

          {!hasDiff && detailEntries.length > 0 ? (
            <div className="rounded-[8px] border border-border/70 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Details
              </p>
              <dl className="space-y-2">
                {detailEntries.map((entry) => (
                  <div key={entry.label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                    <dt className="text-xs font-medium text-slate-500">{entry.label}</dt>
                    <dd className="break-words text-xs whitespace-pre-wrap">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {!hasDiff && detailEntries.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No field-level changes were recorded for this event.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
