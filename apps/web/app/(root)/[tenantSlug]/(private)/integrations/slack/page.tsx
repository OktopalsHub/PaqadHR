import { redirect } from 'next/navigation';

export default function SlackIntegrationPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/${params.tenantSlug}/settings?tab=integrations`);
}
