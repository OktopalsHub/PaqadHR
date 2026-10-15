'use client';

import Link from 'next/link';
import { useTenantHref } from '@/hooks/use-tenant-nav-items';

const mentionClassName = 'font-medium text-sky-600 hover:underline dark:text-sky-400';

/**
 * Renders an @mention. Links to the member's employee profile when the
 * member id is known and a tenant context exists; otherwise falls back to a
 * styled, non-interactive span.
 */
export function MentionChip({ memberId, label }: { memberId?: string; label: string }) {
  const tenantHref = useTenantHref();

  if (!memberId) {
    return <span className={mentionClassName}>{label}</span>;
  }

  return (
    <Link href={tenantHref(`employees/${memberId}`)} className={mentionClassName}>
      {label}
    </Link>
  );
}
