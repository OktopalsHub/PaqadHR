import { redirect } from 'next/navigation';

export default function SetupChannelPage({
  params,
  searchParams,
}: {
  params: { tenantSlug: string };
  searchParams: { integration_id?: string; platform?: string };
}) {
  const qs = new URLSearchParams({ tab: 'integrations', slack_setup: '1' });
  if (searchParams.integration_id) {
    qs.set('integration_id', searchParams.integration_id);
  }
  redirect(`/${params.tenantSlug}/settings?${qs.toString()}`);
}
