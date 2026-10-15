import axios from 'axios';
import { z } from 'zod';
import { apiClient, tenantPath } from '@/lib/api/client';
import { resolveTenantId } from '@/lib/api/tenants';
import { mapApiCandidate, mapApiCandidates } from '@/lib/mappers/recruitment';
import {
  type Candidate,
  type CandidateStatus,
  type CreateCandidateInput,
  type CreateJobOpeningInput,
  candidateSchema,
  type JobOpening,
  jobOpeningSchema,
  jobsListResponseSchema,
} from '@/lib/schemas/recruitment';

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
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  query.set('limit', String(params?.limit ?? 50));

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const data = await apiClient<unknown>(`${tenantPath(tenantId, 'jobs')}${suffix}`);

  return jobsListResponseSchema.parse(data);
}

export async function fetchJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}`));
  return jobOpeningSchema.parse(data);
}

export async function createJobOpening(input: CreateJobOpeningInput): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const { publish: _publish, ...body } = input;
  const created = await apiClient<unknown>(tenantPath(tenantId, 'jobs'), {
    method: 'POST',
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
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}/activate`), {
    method: 'PATCH',
  });
  return jobOpeningSchema.parse(data);
}

export async function deactivateJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}/deactivate`), {
    method: 'PATCH',
  });
  return jobOpeningSchema.parse(data);
}

export async function closeJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}/close`), {
    method: 'PATCH',
  });
  return jobOpeningSchema.parse(data);
}

export async function archiveJobOpening(jobId: string): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}/archive`), {
    method: 'PATCH',
  });
  return jobOpeningSchema.parse(data);
}

export async function deleteJobOpening(jobId: string): Promise<void> {
  const tenantId = await resolveTenantId();
  await apiClient(tenantPath(tenantId, `jobs/${jobId}`), { method: 'DELETE' });
}

export async function updateJobOpening(
  jobId: string,
  input: Partial<CreateJobOpeningInput>,
): Promise<JobOpening> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `jobs/${jobId}`), {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return jobOpeningSchema.parse(data);
}

export type JobStats = {
  total: number;
  draft: number;
  active: number;
  inactive: number;
  closed: number;
  archived: number;
};

export async function fetchJobStats(): Promise<JobStats> {
  const tenantId = await resolveTenantId();
  return apiClient<JobStats>(tenantPath(tenantId, 'jobs/stats'));
}

export async function fetchCandidatesByJob(jobId: string): Promise<Candidate[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `candidates/jobs/${jobId}`));
  return parseCandidates(data);
}

export async function fetchAllCandidates(): Promise<Candidate[]> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, 'candidates'));
  return parseCandidates(data);
}

export async function createCandidate(input: CreateCandidateInput): Promise<Candidate> {
  const tenantId = await resolveTenantId();
  const body = {
    ...input,
    linkedinUrl: input.linkedinUrl || undefined,
    portfolioUrl: input.portfolioUrl || undefined,
  };
  const data = await apiClient<unknown>(tenantPath(tenantId, 'candidates'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return candidateSchema.parse(mapApiCandidate(data as never));
}

export async function updateCandidateStatus(
  candidateId: string,
  status: CandidateStatus,
): Promise<Candidate> {
  const tenantId = await resolveTenantId();
  const data = await apiClient<unknown>(tenantPath(tenantId, `candidates/${candidateId}/status`), {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return candidateSchema.parse(data);
}

export async function fetchPublicJobs(
  tenantId: string,
  params?: {
    search?: string;
    departmentId?: string;
    employmentType?: string;
    location?: string;
  },
  signal?: AbortSignal,
): Promise<{ jobs: JobOpening[]; total: number }> {
  const query = new URLSearchParams();
  query.set('tenantId', tenantId);
  if (params?.search) query.set('search', params.search);
  if (params?.departmentId) query.set('departmentId', params.departmentId);
  if (params?.employmentType) query.set('employmentType', params.employmentType);
  if (params?.location) query.set('location', params.location);
  query.set('limit', '100');

  const data = await apiClient<unknown>(`/jobs?${query.toString()}`, {
    method: 'GET',
    skipCsrf: true,
    signal,
  });

  return jobsListResponseSchema.parse(data);
}

export async function fetchPublicJob(jobId: string): Promise<JobOpening> {
  const data = await apiClient<unknown>(`/jobs/${jobId}`, {
    method: 'GET',
    skipCsrf: true,
  });
  return jobOpeningSchema.parse(data);
}

export type PublicApplicationCustomAnswer = string | string[] | boolean | number;

export type PublicApplicationPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  coverLetterText?: string;
  resumeFilename: string;
  coverLetterFilename?: string;
  customAnswers: Record<string, PublicApplicationCustomAnswer>;
  experience: { years: number };
  dataProcessingConsent: boolean;
};

export async function submitPublicApplication(
  jobId: string,
  body: PublicApplicationPayload & { turnstileToken?: string },
): Promise<{ id: string; status: string; jobOpeningId: string }> {
  return apiClient<{ id: string; status: string; jobOpeningId: string }>(`/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
    skipCsrf: true,
  });
}

export async function requestPublicUploadUrl(
  jobId: string,
  location: 'resumes' | 'cover-letters',
  originalName: string,
  contentType?: string,
  contentLength?: number,
): Promise<{ uploadUrl: string; fileKey: string; fileName: string }> {
  return apiClient<{ uploadUrl: string; fileKey: string; fileName: string }>(
    `/jobs/${jobId}/apply/upload-url`,
    {
      method: 'POST',
      body: JSON.stringify({
        location,
        originalName,
        contentType,
        contentLength,
      }),
      skipCsrf: true,
    },
  );
}

export async function uploadPublicCandidateFile(
  jobId: string,
  file: File,
  location: 'resumes' | 'cover-letters',
): Promise<{ fileName: string; fileKey: string }> {
  const { uploadUrl, fileName, fileKey } = await requestPublicUploadUrl(
    jobId,
    location,
    file.name,
    file.type || undefined,
    file.size,
  );
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });
  return { fileName, fileKey };
}
