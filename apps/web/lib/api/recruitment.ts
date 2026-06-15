import { apiClient, tenantPath } from "@/lib/api/client";
import { resolveTenantId } from "@/lib/api/tenants";
import { mapApiCandidate, mapApiCandidates } from "@/lib/mappers/recruitment";
import {
  jobOpeningSchema,
  jobsListResponseSchema,
  candidateSchema,
  type CreateJobOpeningInput,
  type CreateCandidateInput,
  type JobOpening,
  type Candidate,
  type CandidateStatus,
} from "@/lib/schemas/recruitment";
import { z } from "zod";

function parseCandidates(data: unknown): Candidate[] {
  const items = Array.isArray(data) ? data : [];
  const mapped = mapApiCandidates(items as never);
  return z.array(candidateSchema).parse(mapped);
}

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
  return parseCandidates(data);
}

export async function fetchAllCandidates(): Promise<Candidate[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, "candidates"));
  return parseCandidates(data);
}

export async function createCandidate(
  input: CreateCandidateInput,
): Promise<Candidate> {
  const tenantId = await resolveTenantId();
  const body = {
    ...input,
    linkedinUrl: input.linkedinUrl || undefined,
    portfolioUrl: input.portfolioUrl || undefined,
  };
  const data = await apiClient<unknown>(tenantPath(tenantId, "candidates"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  return candidateSchema.parse(mapApiCandidate(data as never));
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
