'use client';

import { ContentCard } from '@/components/content-card';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { useTenantActivities } from '@/hooks/queries/use-activities';

const AUDIT_CATALOG = [
  'Login / logout / failed login',
  'Password change and reset',
  'Role and permission changes',
  'Payment method updates',
  'Security events (403, rate limit, cross-tenant)',
];

const ACTIVITIES_CATALOG = [
  'Leave requests, approvals, and rejections',
  'Payroll runs, approvals, disbursements, exports',
  'Attendance and exceptions',
  'Employee hire / terminate / org changes',
  'Rewards wallet funding and redemptions',
  'Workspace settings changes',
];

export function SettingsActivitiesTab() {
  const { data, isLoading } = useTenantActivities({ limit: 50 });

  if (isLoading) return <LoadingBlock />;

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <ContentCard
        title="What we log"
        description="Audit is user/security scoped. Activities are workspace events visible only for this tenant."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Audit (user)</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {AUDIT_CATALOG.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Activities (tenant)</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {ACTIVITIES_CATALOG.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </ContentCard>

      <ContentCard
        title="Workspace activity"
        description={`${data?.total ?? 0} events in this tenant`}
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet. Payroll and other workspace actions will appear here.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {item.action}
                    </Badge>
                    {item.resourceType ? (
                      <span className="text-xs text-muted-foreground">{item.resourceType}</span>
                    ) : null}
                    <Badge
                      variant={item.status === 'FAILED' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground">{item.description}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </time>
              </div>
            ))}
          </div>
        )}
      </ContentCard>
    </div>
  );
}
