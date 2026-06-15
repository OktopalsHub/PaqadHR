import { redirect } from "next/navigation";
import { tenantPath } from "@/lib/navigation/tenant-routes";

export default async function CalendarRedirectPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(tenantPath(tenantSlug, "schedule"));
}
