'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchPublicJob,
  fetchPublicJobs,
  type PublicApplicationPayload,
  submitPublicApplication,
  uploadPublicCandidateFile,
} from '@/lib/api/recruitment';

export function usePublicJobs(
  tenantId: string | null,
  filters?: {
    search?: string;
    departmentId?: string;
    employmentType?: string;
    location?: string;
  },
) {
  return useQuery({
    queryKey: ['public-jobs', tenantId, filters],
    queryFn: () => fetchPublicJobs(tenantId!, filters),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicJob(jobId: string | null) {
  return useQuery({
    queryKey: ['public-job', jobId],
    queryFn: () => fetchPublicJob(jobId!),
    enabled: Boolean(jobId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitPublicApplication() {
  return useMutation({
    mutationFn: ({
      jobId,
      body,
    }: {
      jobId: string;
      body: PublicApplicationPayload & { turnstileToken?: string };
    }) => submitPublicApplication(jobId, body),
  });
}

export function useUploadPublicCandidateFile() {
  return useMutation({
    mutationFn: ({
      jobId,
      file,
      location,
    }: {
      jobId: string;
      file: File;
      location: 'resumes' | 'cover-letters';
    }) => uploadPublicCandidateFile(jobId, file, location),
  });
}
