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
  formatActivityTitle,
  getActivityPresentation,
} from '../lib/activity-format';

type ActivityDetailDialogProps = {
  activity: TenantActivity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

const HIDDEN_META_KEYS = new Set(['beforeData', 'afterData', 'provider', 'paymentProvider']);

function DiffTable({
  title,
  data,
  tone,
}: {
  title: string;
  data: Record<string, unknown>;
  tone: 'before' | 'after';
}) {
  const entries = Object.entries(data);
  return (
    <div
      className={cn(
        'rounded-[8px] border p-3',
        tone === 'before'
          ? 'border-rose-200/80 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20'
          : 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No fields recorded</p>
      ) : (
        <dl className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {humanizeKey(key)}
              </dt>
              <dd className="break-words font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function ActivityDetailDialog({ activity, open, onOpenChange }: ActivityDetailDialogProps) {
  if (!activity) return null;

  const { icon: Icon, iconClassName, title } = getActivityPresentation(activity);
  const actor = formatActivityActor(activity.actorName, activity.actorMemberId);
  const when = format(new Date(activity.createdAt), 'PPpp');
  const failed = activity.status?.toLowerCase() === 'failed';
  const metadata = activity.metadata ?? {};
  const beforeData = isPlainRecord(metadata.beforeData) ? metadata.beforeData : null;
  const afterData = isPlainRecord(metadata.afterData) ? metadata.afterData : null;
  const hasDiff = Boolean(beforeData || afterData);
  const otherMeta = Object.entries(metadata).filter(([key]) => !HIDDEN_META_KEYS.has(key));

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
                {formatActivityTitle(activity) !== activity.description
                  ? activity.description
                  : 'What happened in this workspace event.'}
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
              {actor}
            </span>
            <time dateTime={activity.createdAt} className="text-slate-500 dark:text-slate-400">
              {when}
            </time>
            {failed ? <span className="font-semibold text-destructive">Failed</span> : null}
          </div>

          <dl className="grid gap-2 rounded-[8px] border border-border/70 bg-muted/20 p-3 text-sm">
            <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
              <dt className="text-xs font-medium text-slate-500">Action</dt>
              <dd className="font-mono text-xs">{activity.action}</dd>
            </div>
            {activity.resourceType ? (
              <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
                <dt className="text-xs font-medium text-slate-500">Resource</dt>
                <dd className="text-xs">
                  {activity.resourceType}
                  {activity.resourceId ? (
                    <span className="ml-1 font-mono text-slate-500">{activity.resourceId}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr]">
              <dt className="text-xs font-medium text-slate-500">Status</dt>
              <dd className="text-xs capitalize">{activity.status}</dd>
            </div>
          </dl>

          {hasDiff ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DiffTable title="Before" data={beforeData ?? {}} tone="before" />
              <DiffTable title="After" data={afterData ?? {}} tone="after" />
            </div>
          ) : null}

          {!hasDiff && otherMeta.length > 0 ? (
            <div className="rounded-[8px] border border-border/70 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Details
              </p>
              <dl className="space-y-2">
                {otherMeta.map(([key, value]) => (
                  <div key={key} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
                    <dt className="text-xs font-medium text-slate-500">{humanizeKey(key)}</dt>
                    <dd className="break-words font-mono text-xs whitespace-pre-wrap">
                      {formatValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {!hasDiff && otherMeta.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No additional field-level change details were recorded for this event.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
