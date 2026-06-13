import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import type { MemberPointsBalance } from "@/lib/schemas/member-points";

export async function fetchMyPointsBalance(): Promise<MemberPointsBalance> {
  const tenantId = await resolveTenantId();
  return apiClient<MemberPointsBalance>(
    tenantPath(tenantId, "member-points/me"),
  );
}
