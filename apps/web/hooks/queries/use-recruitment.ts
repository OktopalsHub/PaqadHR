'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveJobOpening,
  closeJobOpening,
  createCandidate,
  createJobOpening,
  deactivateJobOpening,
  deleteJobOpening,
  fetchAllCandidates,
  fetchCandidatesByJob,
  fetchJobOpening,
  fetchJobOpenings,
  fetchJobStats,
  updateCandidateStatus,
  updateJobOpening,
  fetchDashboardRecruitmentSummary,
} from '@/lib/api/recruitment';
import { queryKeys } from '@/lib/query/keys';
import {
  applyOptimisticUpdate,
  isLastInFlightMutation,
  patchListItem,
} from '@/lib/query/optimistic';
import type {
  Candidate,
  CandidateStatus,
  CreateCandidateInput,
  CreateJobOpeningInput,
} from '@/lib/schemas/recruitment';
import { useTenant } from '@/providers/tenant-provider';

// Sits under the candidates prefix so every candidate or job mutation that already
// refreshes the full lists refreshes this summary as well.
function dashboardSummaryKey(tenantId: string | null | undefined) {
  return [...queryKeys.recruitment.allCandidates, tenantId, 'dashboard-summary'] as const;
}

export function useDashboardRecruitmentSummary(options?: { enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: dashboardSummaryKey(tenantId),
    queryFn: fetchDashboardRecruitmentSummary,
    enabled: (options?.enabled ?? true) && !tenantLoading && Boolean(tenantId),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useJobOpenings(searchOrOptions?: string | { search?: string; enabled?: boolean }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const search = typeof searchOrOptions === 'string' ? searchOrOptions : searchOrOptions?.search;
  const enabledOption = typeof searchOrOptions === 'object' ? searchOrOptions.enabled : undefined;

  return useQuery({
    queryKey: [...queryKeys.recruitment.jobs, tenantId, search ?? ''],
    queryFn: () => fetchJobOpenings({ search, limit: 50 }),
    enabled: (enabledOption ?? true) && !tenantLoading && Boolean(tenantId),
    placeholderData: keepPreviousData,
  });
}

export function useJobOpening(jobId: string | null) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.job(jobId ?? ''), tenantId],
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
      void queryClient.invalidateQueries({
        queryKey: dashboardSummaryKey(tenantId),
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
          queryKey: [...queryKeys.recruitment.candidates(candidate.jobOpeningId), tenantId],
        });
      }
    },
  });
}

export function useCandidatesByJob(jobId: string | null) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.candidates(jobId ?? ''), tenantId],
    queryFn: () => fetchCandidatesByJob(jobId!),
    enabled: !tenantLoading && Boolean(tenantId) && Boolean(jobId),
    retry: false,
  });
}

export function useAllCandidates(options?: { enabled?: boolean; limit?: number }) {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.allCandidates, tenantId, options?.limit],
    queryFn: fetchAllCandidates,
    select: options?.limit ? (data) => data.slice(0, options.limit) : undefined,
    enabled: (options?.enabled ?? true) && !tenantLoading && Boolean(tenantId),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateCandidateStatus(jobId: string | null) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const mutationKey = ['recruitment', 'update-candidate-status'] as const;

  return useMutation({
    mutationKey,
    mutationFn: ({ candidateId, status }: { candidateId: string; status: CandidateStatus }) =>
      updateCandidateStatus(candidateId, status),
    // Move the card right away; the board is rebuilt from these lists.
    onMutate: async ({ candidateId, status }) => {
      const rollbacks = await Promise.all(
        [
          [...queryKeys.recruitment.allCandidates, tenantId],
          ['recruitment', 'candidates'],
        ].map((queryKey) =>
          applyOptimisticUpdate<unknown>(queryClient, queryKey, (data) =>
            patchListItem<Candidate>(data, candidateId, { status }),
          ),
        ),
      );
      return {
        rollback: () => {
          for (const rollback of rollbacks) rollback();
        },
      };
    },
    onError: (_error, _variables, context) => context?.rollback(),
    onSettled: () => {
      if (!isLastInFlightMutation(queryClient, mutationKey)) return;
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

export function useDeactivateJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (jobId: string) => deactivateJobOpening(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.recruitment.jobs, tenantId] });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
    },
  });
}

export function useCloseJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (jobId: string) => closeJobOpening(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.recruitment.jobs, tenantId] });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
    },
  });
}

export function useArchiveJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (jobId: string) => archiveJobOpening(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.recruitment.jobs, tenantId] });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
    },
  });
}

export function useDeleteJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: (jobId: string) => deleteJobOpening(jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.recruitment.jobs, tenantId] });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.allCandidates, tenantId],
      });
    },
  });
}

export function useUpdateJobOpening() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: ({ jobId, input }: { jobId: string; input: Partial<CreateJobOpeningInput> }) =>
      updateJobOpening(jobId, input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.recruitment.jobs, tenantId] });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.recruitment.job(variables.jobId), tenantId],
      });
      void queryClient.invalidateQueries({ queryKey: dashboardSummaryKey(tenantId) });
    },
  });
}

export function useJobStats() {
  const { tenantId, isLoading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: [...queryKeys.recruitment.jobs, 'stats', tenantId],
    queryFn: fetchJobStats,
    enabled: !tenantLoading && Boolean(tenantId),
  });
}
