import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";

export type ApiEducation = {
  id: string;
  title: string;
  degreeType: string;
  institution: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  gpa?: string;
  tenantMemberId: string;
};

export type CreateEducationInput = {
  memberId: string;
  title: string;
  degreeType: string;
  institution: string;
  fieldOfStudy?: string;
  endDate?: string;
  description?: string;
  gpa?: string;
};

export async function fetchEducationRecords(
  memberId: string,
): Promise<ApiEducation[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<ApiEducation[]>(
    `${tenantPath(tenantId, "education")}?memberId=${memberId}`,
  );
  return Array.isArray(data) ? data : [];
}

export async function createEducationRecord(
  input: CreateEducationInput,
): Promise<ApiEducation> {
  const tenantId = await resolveTenantId();
  return apiClient<ApiEducation>(tenantPath(tenantId, "education"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteEducationRecord(id: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `education/${id}`), {
    method: "DELETE",
  });
}
