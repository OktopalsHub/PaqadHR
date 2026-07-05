'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';

export function ViewCareersPageLink() {
  const tenantHref = useTenantHref();
  const href = tenantHref('careers');

  return (
    <Button
      variant="outline"
      className="h-10 w-full justify-center rounded-[8px] border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 sm:w-auto dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200 dark:shadow-none dark:hover:bg-slate-900 dark:hover:text-white"
      asChild
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" />
        View careers page
      </a>
    </Button>
  );
}
