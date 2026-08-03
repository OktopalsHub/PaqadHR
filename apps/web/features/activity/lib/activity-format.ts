import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarClock,
  FileText,
  Gift,
  Megaphone,
  ScrollText,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { TenantActivity } from '@/lib/api/activities';

export type ActivityCategory =
  | 'all'
  | 'leave'
  | 'payroll'
  | 'rewards'
  | 'shoutouts'
  | 'settings'
  | 'org'
  | 'other';

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

const EMAIL_RE = /@/;

function inviteeNameFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const name = metadata?.inviteeName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/** Short, tenant-member-first titles for the activity feed (hides legacy email-heavy descriptions). */
export function formatActivityTitle(activity: TenantActivity): string {
  const { action, description, metadata } = activity;
  const inviteeName = inviteeNameFromMetadata(metadata);

  switch (action) {
    case 'invite.sent':
      if (inviteeName && inviteeName !== 'A team member') return `Invited ${inviteeName}`;
      if (EMAIL_RE.test(description)) return 'Invitation sent';
      return description.replace(/^Invitation sent to /i, 'Invited ') || 'Invitation sent';
    case 'invite.accepted':
      if (inviteeName && inviteeName !== 'A team member') return `${inviteeName} joined`;
      if (EMAIL_RE.test(description)) return 'Member joined';
      return description.replace(/\s+joined\s+.+$/i, ' joined').trim() || 'Member joined';
    case 'wallet.deposit':
      return 'Wallet topped up';
    case 'reward.redeemed': {
      const rewardName = metadata?.rewardName;
      if (typeof rewardName === 'string' && rewardName.trim())
        return `${rewardName.trim()} redeemed`;
      return (
        description.replace(/\s+for\s+[\d,]+\s+points$/i, ' redeemed').trim() || 'Reward redeemed'
      );
    }
    case 'wallet.auto_topup_updated':
      return description;
    case 'points.assigned':
      return description;
    case 'shoutout.created':
      return description;
    case 'settings.updated': {
      const sections = metadata?.sections;
      if (Array.isArray(sections) && sections.length > 0) {
        return `Updated ${sections.join(', ')} settings`;
      }
      return description;
    }
    case 'member.updated':
    case 'member.profile_updated':
    case 'member.removed':
    case 'member.reactivated':
    case 'member.deactivated':
      return description;
    default:
      return description;
  }
}

function resolveCategory(activity: TenantActivity): ActivityCategory {
  const { resourceType, action } = activity;
  if (resourceType === 'leave' || action.startsWith('leave.')) return 'leave';
  if (resourceType === 'payroll' || PAYROLL_ACTIONS.has(action)) return 'payroll';
  if (
    action === 'points.assigned' ||
    action === 'shoutout.created' ||
    resourceType === 'shoutout'
  ) {
    return 'shoutouts';
  }
  if (resourceType === 'settings' || action === 'settings.updated') return 'settings';
  if (
    resourceType === 'member' ||
    resourceType === 'department' ||
    resourceType === 'team' ||
    action.startsWith('member.') ||
    action.startsWith('department.') ||
    action.startsWith('team.')
  ) {
    return 'org';
  }
  if (
    resourceType === 'reward' ||
    resourceType === 'rewards_wallet' ||
    resourceType === 'points' ||
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
  const title = formatActivityTitle(activity);

  switch (category) {
    case 'leave':
      return {
        icon: CalendarClock,
        iconClassName: 'bg-sky-500/10 text-sky-700',
        title,
      };
    case 'payroll':
      return {
        icon: FileText,
        iconClassName: 'bg-violet-500/10 text-violet-700',
        title,
      };
    case 'rewards':
      return {
        icon: activity.action.startsWith('wallet.') ? Wallet : Gift,
        iconClassName: 'bg-emerald-500/10 text-emerald-700',
        title,
      };
    case 'shoutouts':
      return {
        icon: Megaphone,
        iconClassName: 'bg-amber-500/10 text-amber-700',
        title,
      };
    case 'settings':
      return {
        icon: Settings,
        iconClassName: 'bg-linear-to-br from-cyan-500/20 to-blue-500/15 text-cyan-700',
        title,
      };
    case 'org':
      return {
        icon:
          activity.resourceType === 'department'
            ? Building2
            : activity.resourceType === 'team'
              ? Users
              : UserPlus,
        iconClassName: 'bg-blue-500/10 text-blue-700',
        title,
      };
    default:
      if (activity.resourceType === 'invitation' || activity.action.startsWith('invite.')) {
        return {
          icon: UserPlus,
          iconClassName: 'bg-primary/10 text-primary',
          title,
        };
      }
      return {
        icon: ScrollText,
        iconClassName: 'bg-muted text-muted-foreground',
        title,
      };
  }
}

export function formatActivityActor(
  actorName: string | null,
  actorMemberId?: string | null,
): string {
  const trimmed = actorName?.trim();
  if (trimmed) return trimmed;
  if (actorMemberId) return 'Member';
  return 'System';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Display-friendly field values for activity diffs and details. */
export function formatActivityFieldValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (trimmed === '—' || trimmed === 'None' || trimmed === 'On file' || trimmed === 'Set') {
      return trimmed;
    }
    // Roles / status-like tokens: member → Member
    if (/^[a-z][a-z0-9_]*$/i.test(trimmed) && !trimmed.includes(' ')) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatActivityFieldValue(item)).join(', ') || '—';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function humanizeActivityFieldKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function getActivityChangeEntries(
  activity: TenantActivity,
): Array<{ field: string; from: string; to: string }> {
  const metadata = activity.metadata ?? {};
  const before = isPlainRecord(metadata.beforeData) ? metadata.beforeData : null;
  const after = isPlainRecord(metadata.afterData) ? metadata.afterData : null;
  if (!before && !after) return [];

  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return keys.map((key) => ({
    field: humanizeActivityFieldKey(key),
    from: formatActivityFieldValue(before?.[key]),
    to: formatActivityFieldValue(after?.[key]),
  }));
}

/** One-line preview for compact contexts. Prefer rendering Before/After in the UI. */
export function formatActivityChangePreview(activity: TenantActivity): string | null {
  const entries = getActivityChangeEntries(activity);
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    const [entry] = entries;
    return `${entry.field}: before ${entry.from}, after ${entry.to}`;
  }
  return `${entries.length} fields changed`;
}

/** Extra metadata shown in the detail panel (hides ids and diff blobs). */
export function getActivityDetailEntries(
  activity: TenantActivity,
): Array<{ label: string; value: string }> {
  const metadata = activity.metadata ?? {};
  const hidden = new Set(['beforeData', 'afterData', 'provider', 'paymentProvider']);
  return Object.entries(metadata)
    .filter(([key]) => {
      if (hidden.has(key)) return false;
      if (/Id$/i.test(key) || key === 'id') return false;
      return true;
    })
    .map(([key, value]) => ({
      label: humanizeActivityFieldKey(key),
      value: formatActivityFieldValue(value),
    }));
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
