'use client';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';

export function ViewCareersPageLink() {
  const tenantHref = useTenantHref();
  const href = tenantHref('careers');

  return (
    <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-1.5 size-3.5" />
        View careers page
      </a>
    </Button>
  );
}
