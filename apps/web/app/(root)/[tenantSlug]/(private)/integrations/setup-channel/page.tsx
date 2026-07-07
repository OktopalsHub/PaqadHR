import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ integration_id?: string; platform?: string }>;
};

export default async function SetupChannelPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const qs = new URLSearchParams({ tab: 'integrations', slack_setup: '1' });
  if (resolvedSearchParams.integration_id) {
    qs.set('integration_id', resolvedSearchParams.integration_id);
  }
  redirect(`/${tenantSlug}/settings?${qs.toString()}`);
}
