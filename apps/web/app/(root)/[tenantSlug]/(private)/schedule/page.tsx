import { notFound, redirect } from 'next/navigation';
import { isValidTenantSlug, tenantPath } from '@/lib/navigation/tenant-routes';

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  if (!isValidTenantSlug(tenantSlug)) {
    notFound();
  }

  redirect(tenantPath(tenantSlug, 'calendar'));
}
