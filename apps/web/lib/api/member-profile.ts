import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { memberProfileSchema } from "@/lib/schemas/member-profile";

export async function fetchMemberProfile() {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, "profile"));
  return memberProfileSchema.parse(data);
}
