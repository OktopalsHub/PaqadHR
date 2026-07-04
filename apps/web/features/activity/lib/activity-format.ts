import type { LucideIcon } from 'lucide-react';
import { CalendarClock, FileText, Gift, ScrollText, Settings, UserPlus, Wallet } from 'lucide-react';
import type { TenantActivity } from '@/lib/api/activities';

export type ActivityCategory = 'all' | 'leave' | 'payroll' | 'rewards' | 'other';

export type ActivityPresentation = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
};

const PAYROLL_ACTIONS = new Set([
  'payroll_created',
  'payroll_processed',
  'payroll_cancelled',
  'payment_sent',
  'payment_failed',
  'payroll_approved',
  'payroll_disbursed_manual',
  'payroll_exported',
  'payslips_published',
]);

function resolveCategory(activity: TenantActivity): ActivityCategory {
  const { resourceType, action } = activity;
  if (resourceType === 'leave' || action.startsWith('leave.')) return 'leave';
  if (resourceType === 'payroll' || PAYROLL_ACTIONS.has(action)) return 'payroll';
  if (
    resourceType === 'reward' ||
    resourceType === 'rewards_wallet' ||
    action.startsWith('reward.') ||
    action.startsWith('wallet.')
  ) {
    return 'rewards';
  }
  if (resourceType === 'invitation' || action.startsWith('invite.')) return 'other';
  return 'other';
}

export function getActivityCategory(activity: TenantActivity): ActivityCategory {
  return resolveCategory(activity);
}

export function getActivityPresentation(activity: TenantActivity): ActivityPresentation {
  const category = resolveCategory(activity);

  switch (category) {
    case 'leave':
      return {
        icon: CalendarClock,
        iconClassName: 'bg-sky-500/10 text-sky-700',
        title: activity.description,
      };
    case 'payroll':
      return {
        icon: FileText,
        iconClassName: 'bg-violet-500/10 text-violet-700',
        title: activity.description,
      };
    case 'rewards':
      return {
        icon: activity.action.startsWith('wallet.') ? Wallet : Gift,
        iconClassName: 'bg-emerald-500/10 text-emerald-700',
        title: activity.description,
      };
    default:
      if (activity.resourceType === 'settings') {
        return {
          icon: Settings,
          iconClassName: 'bg-muted text-muted-foreground',
          title: activity.description,
        };
      }
      if (activity.resourceType === 'invitation' || activity.action.startsWith('invite.')) {
        return {
          icon: UserPlus,
          iconClassName: 'bg-primary/10 text-primary',
          title: activity.description,
        };
      }
      return {
        icon: ScrollText,
        iconClassName: 'bg-muted text-muted-foreground',
        title: activity.description,
      };
  }
}

export function formatActivityActor(actorName: string | null): string {
  const trimmed = actorName?.trim();
  return trimmed && trimmed.length > 1 ? trimmed : 'System';
}

export function groupActivitiesByDay(
  activities: TenantActivity[],
): Array<{ label: string; items: TenantActivity[] }> {
  const groups = new Map<string, TenantActivity[]>();

  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const label = getDayGroupLabel(date);
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(activity);
    } else {
      groups.set(label, [activity]);
    }
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function getDayGroupLabel(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
