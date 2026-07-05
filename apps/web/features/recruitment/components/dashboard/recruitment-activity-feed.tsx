'use client';

import { formatDistanceToNow } from 'date-fns';
import { ContentCard } from '@/components/content-card';
import { PersonAvatar } from '@/components/person-avatar';
import type { ActivityItem } from '../../lib/recruitment-types';

type RecruitmentActivityFeedProps = {
  items: ActivityItem[];
};

export function RecruitmentActivityFeed({ items }: RecruitmentActivityFeedProps) {
  return (
    <ContentCard
      title="Recent activity"
      className="dashboard-panel min-w-0 h-full rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
      titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
      bodyClassName="min-w-0 flex-1 space-y-3 p-4 sm:p-5"
    >
      {items.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center text-center">
          <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
            Activity will appear here as your team works in Recruitment.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="dashboard-soft-tile rounded-[8px] flex items-start gap-3 p-3.5"
          >
            <PersonAvatar
              name={item.actor}
              className="size-8 shrink-0 border border-[#d7e3f6] bg-white dark:border-slate-700 dark:bg-slate-900"
              fallbackClassName="bg-white text-[10px] font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900 dark:text-slate-100">
                <span className="font-medium">{item.actor}</span>{' '}
                <span className="text-slate-600 dark:text-slate-400">{item.action}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
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
