import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import type {
  CreateShoutoutInput,
  ShoutoutFeed,
  ShoutoutCategory,
} from "@/lib/schemas/shoutout";

export async function fetchShoutouts(
  params?: { page?: number; limit?: number },
): Promise<ShoutoutFeed> {
  const tenantId = await resolveTenantId();
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiClient<ShoutoutFeed>(
    `${tenantPath(tenantId, "shoutouts")}${qs ? `?${qs}` : ""}`,
  );
}

export async function createShoutout(
  input: CreateShoutoutInput,
): Promise<unknown> {
  const tenantId = await resolveTenantId();
  return apiClient(tenantPath(tenantId, "shoutouts"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchShoutoutCategories(): Promise<ShoutoutCategory[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ShoutoutCategory[] | { records: ShoutoutCategory[] }>(
    tenantPath(tenantId, "shoutout-categories"),
  );
  return Array.isArray(data) ? data : (data.records ?? []);
}
