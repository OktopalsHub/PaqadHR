import { queryKeys } from '@/lib/query/keys';

type LeaveMutationQueryClient = {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<unknown>;
};

export async function invalidateLeaveMutationQueries(
  queryClient: LeaveMutationQueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leaves.balances }),
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.events }),
  ]);
}
