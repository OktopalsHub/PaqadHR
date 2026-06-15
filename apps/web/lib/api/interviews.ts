import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";

export type Interview = {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  type: string;
  status: string;
  date: string;
  duration: number;
  location?: string;
  candidate?: {
    firstName?: string;
    lastName?: string;
  };
  jobOpening?: {
    title?: string;
  };
};

export async function fetchInterviewsToday(): Promise<Interview[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<Interview[]>(
    tenantPath(tenantId, "interviews/today"),
  );
  return Array.isArray(data) ? data : [];
}

export async function fetchUpcomingInterviews(days = 30): Promise<Interview[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<Interview[]>(
    tenantPath(tenantId, `interviews/upcoming?days=${days}`),
  );
  return Array.isArray(data) ? data : [];
}
