import { redirect } from 'next/navigation';

export default function RewardsRoute({ params }: { params: { tenantSlug: string } }) {
  redirect(`/${params.tenantSlug}/shoutouts?tab=rewards`);
}
