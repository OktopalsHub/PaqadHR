import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ tenantSlug: string; jobId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tenantSlug, jobId } = await params;
  redirect(`/${tenantSlug}/recruitment/roles/${jobId}`);
}
