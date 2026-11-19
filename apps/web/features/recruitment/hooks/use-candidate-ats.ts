'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createOffer,
  fetchCandidateTimeline,
  fetchOffers,
  fetchScorecards,
  fetchTalentPool,
  moveCandidateToStage,
  respondToOffer,
  screenCandidateWithAi,
  sendCandidateEmail,
  sendOffer,
  setTalentPool,
  submitScorecard,
} from '@/lib/api/recruitment-ats';

const key = (name: string, candidateId: string | null) => ['recruitment', name, candidateId];

export function useCandidateTimeline(candidateId: string | null) {
  return useQuery({
    queryKey: key('timeline', candidateId),
    queryFn: () => fetchCandidateTimeline(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

export function useMoveCandidateStage(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => moveCandidateToStage(candidateId, stageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key('timeline', candidateId) });
      void queryClient.invalidateQueries({ queryKey: ['recruitment'] });
    },
  });
}

export function useSendCandidateEmail(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => sendCandidateEmail(candidateId, templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key('timeline', candidateId) }),
  });
}

export function useScreenCandidate(candidateId: string) {
  return useMutation({ mutationFn: () => screenCandidateWithAi(candidateId) });
}

export function useScorecards(candidateId: string | null) {
  return useQuery({
    queryKey: key('scorecards', candidateId),
    queryFn: () => fetchScorecards(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

export function useSubmitScorecard(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof submitScorecard>[1]) =>
      submitScorecard(candidateId, input),
    onSuccess: (data) => queryClient.setQueryData(key('scorecards', candidateId), data),
  });
}

export function useOffers(candidateId: string | null) {
  return useQuery({
    queryKey: key('offers', candidateId),
    queryFn: () => fetchOffers(candidateId as string),
    enabled: Boolean(candidateId),
  });
}

export function useOfferActions(candidateId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key('offers', candidateId) });
    void queryClient.invalidateQueries({ queryKey: ['recruitment'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: Parameters<typeof createOffer>[1]) => createOffer(candidateId, input),
      onSuccess: refresh,
    }),
    send: useMutation({
      mutationFn: (input: { offerId: string; templateId?: string }) =>
        sendOffer(input.offerId, input.templateId),
      onSuccess: refresh,
    }),
    respond: useMutation({
      mutationFn: (input: { offerId: string; outcome: 'ACCEPTED' | 'DECLINED' }) =>
        respondToOffer(input.offerId, input.outcome),
      onSuccess: refresh,
    }),
  };
}

export function useTalentPool() {
  return useQuery({ queryKey: ['recruitment', 'talent-pool'], queryFn: fetchTalentPool });
}

export function useToggleTalentPool(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inPool: boolean) => setTalentPool(candidateId, inPool),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruitment', 'talent-pool'] }),
  });
}
