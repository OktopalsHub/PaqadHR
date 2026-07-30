import { redirect } from 'next/navigation';

export default async function RewardsRoute({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/shoutouts?tab=redeem`);
}
