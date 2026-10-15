import { redirect } from 'next/navigation';

export default async function SlackIntegrationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/settings?tab=integrations`);
}
