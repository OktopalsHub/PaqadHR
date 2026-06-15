"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createJobOpening,
  createCandidate,
  fetchJobOpening,
  fetchJobOpenings,
  fetchCandidatesByJob,
  fetchAllCandidates,
  updateCandidateStatus,
} from "@/lib/api/recruitment";
import type {
  CreateJobOpeningInput,
  CreateCandidateInput,
  CandidateStatus,
} from "@/lib/schemas/recruitment";
import { queryKeys } from "@/lib/query/keys";
import { useTenant } from "@/providers/tenant-provider";

export function useJobOpenings(search?: string) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.jobs, tenantId, search ?? ""],
    queryFn: () => fetchJobOpenings({ search, limit: 50 }),
    enabled: !tenantLoading && Boolean(tenantId),
  });
}

export function useJobOpening(jobId: string | null) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.job(jobId ?? ""), tenantId],
    queryFn: () => fetchJobOpening(jobId!),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(jobId),
  });
}

export function useCreateJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateJobOpeningInput) => createJobOpening(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.jobs, tenantId],
      });
    },
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (input: CreateCandidateInput) => createCandidate(input),
    onSuccess: (candidate) => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
      if (candidate.jobOpeningId) {
        void queryClient.invalidateQueries({
          queryKey: [
            ...queryKeys.recruitment.candidates(candidate.jobOpeningId),
            tenantId,
          ],
        });
      }
    },
  });
}

export function useCandidatesByJob(jobId: string | null) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.candidates(jobId ?? ""), tenantId],
    queryFn: () => fetchCandidatesByJob(jobId!),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(jobId),
    retry: false,
  });
}

export function useAllCandidates() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
    queryFn: fetchAllCandidates,
    enabled: !tenantLoading && Boolean(tenantId),
    retry: false,
  });
}

export function useUpdateCandidateStatus(jobId: string | null) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({
      candidateId,
      status,
    }: {
      candidateId: string;
      status: CandidateStatus;
    }) => updateCandidateStatus(candidateId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
      if (jobId) {
        void queryClient.invalidateQueries({
          queryKey: [...queryKeys.recruitment.candidates(jobId), tenantId],
        });
      }
    },
  });
}
