import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import {
  analyticsOverviewSchema,
  type AnalyticsOverview,
} from "@/lib/schemas/analytics";

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(
    tenantPath(tenantId, "analytics/overview"),
  );
  return analyticsOverviewSchema.parse(data);
}
