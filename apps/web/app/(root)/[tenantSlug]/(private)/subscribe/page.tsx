import { redirect } from 'next/navigation';
import { subscribePagePath } from '@/lib/navigation/tenant-routes';

type TenantSubscribeRedirectProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TenantSubscribeRedirect({
  params,
  searchParams,
}: TenantSubscribeRedirectProps) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  redirect(
    subscribePagePath({
      welcome: query.welcome === '1' ? true : undefined,
      billing: query.billing === 'success' ? true : undefined,
      workspace: tenantSlug,
    }),
  );
}
