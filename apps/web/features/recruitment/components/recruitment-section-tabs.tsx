'use client';

import Link from 'next/link';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { cn } from '@/lib/utils';

type RecruitmentSectionTabsProps = {
  active: 'pipeline' | 'roles' | 'analytics';
};

const TABS = [
  { id: 'pipeline', label: 'Candidate', href: 'recruitment' },
  { id: 'roles', label: 'Roles', href: 'recruitment/roles' },
  { id: 'analytics', label: 'Analytics', href: 'recruitment/analytics' },
] as const;

export function RecruitmentSectionTabs({ active }: RecruitmentSectionTabsProps) {
  const tenantHref = useTenantHref();

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="inline-flex min-w-max flex-nowrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tenantHref(tab.href)}
            className={cn(
              'rounded-[8px] px-5 py-2 text-sm whitespace-nowrap transition-colors sm:px-6',
              active === tab.id
                ? 'border border-slate-200 bg-slate-50 font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none'
                : 'font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
