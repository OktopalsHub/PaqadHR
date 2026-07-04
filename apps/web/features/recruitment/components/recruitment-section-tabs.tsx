'use client';

import Link from 'next/link';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';
import { cn } from '@/lib/utils';

type RecruitmentSectionTabsProps = {
  active: 'pipeline' | 'roles';
};

const TABS = [
  { id: 'pipeline', label: 'Pipeline', href: 'recruitment' },
  { id: 'roles', label: 'Roles & analytics', href: 'recruitment/roles' },
] as const;

export function RecruitmentSectionTabs({ active }: RecruitmentSectionTabsProps) {
  const tenantHref = useTenantHref();

  return (
    <div className="inline-flex w-max flex-wrap items-center rounded-[8px] border border-slate-100 bg-white p-1 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tenantHref(tab.href)}
          className={cn(
            'rounded-[8px] px-6 py-2 text-sm transition-colors',
            active === tab.id
              ? 'border border-slate-200 bg-slate-50 font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-none'
              : 'font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
