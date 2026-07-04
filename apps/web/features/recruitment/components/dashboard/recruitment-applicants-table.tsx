'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ContentCard } from '@/components/content-card';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
} from '@/components/ui/app-table';
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
    <ContentCard
      title="Applicants"
      className="dashboard-panel h-full rounded-[8px]"
      headerClassName="border-b border-[#d7e3f6] px-5 py-4 dark:border-slate-800"
      titleClassName="text-[17px] font-semibold text-slate-950 dark:text-slate-100"
      bodyClassName="space-y-4 p-5"
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-[8px] bg-transparent p-0">
          {TABS.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="dashboard-soft-tile h-9 rounded-[8px] border-transparent px-3 text-xs font-semibold text-slate-600 data-[state=active]:border-[#d2ddf3] data-[state=active]:bg-[#fea619] data-[state=active]:text-[#2a1700] dark:text-slate-300 dark:data-[state=active]:border-amber-500/40 dark:data-[state=active]:text-[#2a1700]"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <AppTable className="min-w-[640px]">
        <AppTableHeaderSection>
          <AppTableHeaderRow>
            <AppTableHeadCell className="pb-3 tracking-[0.14em]">Name</AppTableHeadCell>
            <AppTableHeadCell className="pb-3 tracking-[0.14em]">Role</AppTableHeadCell>
            <AppTableHeadCell className="pb-3 tracking-[0.14em]">Date</AppTableHeadCell>
            <AppTableHeadCell className="pb-3 tracking-[0.14em]">Type</AppTableHeadCell>
            <AppTableHeadCell className="pb-3 tracking-[0.14em]">Status</AppTableHeadCell>
          </AppTableHeaderRow>
        </AppTableHeaderSection>
        <AppTableBodySection>
          {filtered.length === 0 ? (
            <AppTableBodyRow className="hover:bg-transparent">
              <AppTableCell
                colSpan={5}
                className="py-16 text-center text-slate-500 dark:text-slate-400"
              >
                No applicants in this stage.
              </AppTableCell>
            </AppTableBodyRow>
          ) : (
            filtered.slice(0, 12).map((row) => (
              <AppTableBodyRow
                key={row.id}
                className="hover:bg-white/40 dark:hover:bg-slate-900/80"
              >
                <AppTableCell className="py-3.5">
                  <Link
                    href={tenantHref(`recruitment/roles/${row.jobOpeningId}`)}
                    className="flex items-center gap-3 text-slate-900 hover:text-[#2d63c8] dark:text-slate-100 dark:hover:text-blue-300"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src="/placeholder.svg" />
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
                </AppTableCell>
                <AppTableCell className="py-3.5 text-slate-600 dark:text-slate-400">
                  {row.role}
                </AppTableCell>
                <AppTableCell className="py-3.5 text-slate-600 dark:text-slate-400">
                  {row.date ? formatDate(row.date) : '—'}
                </AppTableCell>
                <AppTableCell className="py-3.5 text-slate-600 dark:text-slate-400">
                  {formatEmploymentType(row.employmentType)}
                </AppTableCell>
                <AppTableCell className="py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getCandidateStatusStyles(
                      row.status,
                    )}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${getCandidateStatusDotClass(row.status)}`}
                    />
                    {formatStatusLabel(row.status)}
                  </span>
                </AppTableCell>
              </AppTableBodyRow>
            ))
          )}
        </AppTableBodySection>
      </AppTable>
    </ContentCard>
  );
}
