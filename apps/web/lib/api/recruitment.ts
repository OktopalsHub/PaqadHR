import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import {
  jobOpeningSchema,
  jobsListResponseSchema,
  candidatesListResponseSchema,
  candidateSchema,
  type CreateJobOpeningInput,
  type JobOpening,
  type Candidate,
  type CandidateStatus,
} from "@/lib/schemas/recruitment";

export async function fetchJobOpenings(params?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<{ jobs: JobOpening[]; total: number }> {
  const tenantId = await resolveTenantId();
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  query.set("limit", String(params?.limit ?? 50));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const data = await apiClient<unknown>(
    `${tenantPath(tenantId, "jobs")}${suffix}`,
  );

  return jobsListResponseSchema.parse(data);
}

export async function fetchJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(
    tenantPath(tenantId, `jobs/${jobId}`),
  );
  return jobOpeningSchema.parse(data);
}

export async function createJobOpening(
  input: CreateJobOpeningInput,
): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const { publish: _publish, ...body } = input;
  const created = await apiClient<unknown>(tenantPath(tenantId, "jobs"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  const job = jobOpeningSchema.parse(created);
  if (input.publish) {
    return activateJobOpening(job.id);
  }
  return job;
}

export async function activateJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(
    tenantPath(tenantId, `jobs/${jobId}/activate`),
    { method: "PATCH" },
  );
  return jobOpeningSchema.parse(data);
}

export async function fetchCandidatesByJob(
  jobId: string,
): Promise<Candidate[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(
    tenantPath(tenantId, `candidates/jobs/${jobId}`),
  );
  const parsed = candidatesListResponseSchema.safeParse(data);
  if (!parsed.success) {
    return [];
  }
  return parsed.data;
}

export async function fetchAllCandidates(): Promise<Candidate[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, "candidates"));
  const parsed = candidatesListResponseSchema.safeParse(data);
  if (!parsed.success) {
    return [];
  }
  return parsed.data;
}

export async function updateCandidateStatus(
  candidateId: string,
  status: CandidateStatus,
): Promise<Candidate> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(
    tenantPath(tenantId, `candidates/${candidateId}/status`),
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return candidateSchema.parse(data);
}
