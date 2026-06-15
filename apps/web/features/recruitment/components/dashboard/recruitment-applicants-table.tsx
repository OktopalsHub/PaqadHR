'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ContentCard } from '@/components/content-card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { formatDate } from '@/lib/format-date';
import {
  type ApplicantRow,
  filterApplicantsByTab,
  formatEmploymentType,
  formatStatusLabel,
} from '../../lib/recruitment-dashboard-metrics';

const TABS = [
  { id: 'all', label: 'All applicants' },
  { id: 'screening', label: 'Screening' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Job offer' },
] as const;

type RecruitmentApplicantsTableProps = {
  rows: ApplicantRow[];
};

function statusVariant(status: string) {
  switch (status) {
    case 'HIRED':
    case 'OFFER':
      return 'default' as const;
    case 'INTERVIEW':
      return 'secondary' as const;
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

export function RecruitmentApplicantsTable({ rows }: RecruitmentApplicantsTableProps) {
  const [tab, setTab] = useState<string>('all');
  const tenantHref = useTenantHref();

  const filtered = useMemo(() => filterApplicantsByTab(rows, tab), [rows, tab]);

  return (
    <ContentCard
      title="Applicants"
      description={`${rows.length.toLocaleString()} total`}
      bodyClassName="space-y-4"
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="h-8 rounded-lg px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No applicants in this stage.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 12).map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3">
                    <Link
                      href={tenantHref(`recruitment/roles/${row.jobOpeningId}`)}
                      className="block hover:text-primary"
                    >
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </Link>
                  </td>
                  <td className="py-3 text-muted-foreground">{row.role}</td>
                  <td className="py-3 text-muted-foreground">
                    {row.date ? formatDate(row.date) : '—'}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatEmploymentType(row.employmentType)}
                  </td>
                  <td className="py-3">
                    <Badge variant={statusVariant(row.status)} className="text-[10px]">
                      {formatStatusLabel(row.status)}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ContentCard>
  );
}
