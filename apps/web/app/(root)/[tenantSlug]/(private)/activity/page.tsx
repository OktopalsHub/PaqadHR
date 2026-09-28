import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
};

// The activity log now lives at /logs; keep the old URL working.
export default async function Page({ params }: PageProps) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/logs`);
}
