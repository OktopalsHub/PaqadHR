'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ContentCard } from '@/components/content-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { formatDate } from '@/lib/format-date';
import { getInitials } from '@/lib/utils';
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

function getCandidateStatusStyles(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'HIRED':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900';
    case 'OFFER':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900';
    case 'INTERVIEW':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900';
    case 'SCREENING':
    case 'APPLIED':
    case 'UNDER_REVIEW':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450 dark:border-amber-900';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
  }
}

function getCandidateStatusDotClass(status: string) {
  const key = status.toUpperCase();
  switch (key) {
    case 'HIRED':
      return 'bg-green-500 animate-pulse';
    case 'OFFER':
      return 'bg-blue-500';
    case 'INTERVIEW':
      return 'bg-purple-500';
    case 'SCREENING':
    case 'APPLIED':
    case 'UNDER_REVIEW':
      return 'bg-amber-500';
    case 'REJECTED':
    case 'WITHDRAWN':
      return 'bg-red-500';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
  }
}

function getInitialsColor(name: string): string {
  const colors = [
    'from-pink-500 to-rose-500 text-white',
    'from-purple-500 to-indigo-500 text-white',
    'from-blue-500 to-cyan-500 text-white',
    'from-teal-500 to-emerald-500 text-white',
    'from-amber-500 to-orange-500 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function RecruitmentApplicantsTable({ rows }: RecruitmentApplicantsTableProps) {
  const [tab, setTab] = useState<string>('all');
  const tenantHref = useTenantHref();

  const filtered = useMemo(() => filterApplicantsByTab(rows, tab), [rows, tab]);

  return (
    <ContentCard title="Applicants" bodyClassName="space-y-4">
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
                      className="flex items-center gap-3 hover:text-primary"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback
                          className={`bg-gradient-to-br ${getInitialsColor(row.name)} font-semibold text-xs`}
                        >
                          {getInitials(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </div>
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
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getCandidateStatusStyles(
                        row.status,
                      )}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${getCandidateStatusDotClass(
                          row.status,
                        )}`}
                      />
                      {formatStatusLabel(row.status)}
                    </span>
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
