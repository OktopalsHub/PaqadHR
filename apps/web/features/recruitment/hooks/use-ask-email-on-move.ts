'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchRecruitmentPreferences,
  type RecruitmentPreferences,
  updateRecruitmentPreferences,
} from '@/lib/api/recruitment-ats';

const PREFERENCES_KEY = ['recruitment', 'preferences'] as const;

export function useAskEmailOnMove(): [boolean, (value: boolean) => void] {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: fetchRecruitmentPreferences,
    staleTime: 5 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: (askEmailOnMove: boolean) => updateRecruitmentPreferences({ askEmailOnMove }),
    onMutate: async (askEmailOnMove) => {
      await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });
      const previous = queryClient.getQueryData<RecruitmentPreferences>(PREFERENCES_KEY);
      queryClient.setQueryData<RecruitmentPreferences>(PREFERENCES_KEY, { askEmailOnMove });
      return { previous };
    },
    onError: (_error, _value, context) => {
      if (context?.previous) queryClient.setQueryData(PREFERENCES_KEY, context.previous);
    },
  });
  return [data?.askEmailOnMove ?? true, (value) => mutation.mutate(value)];
}
