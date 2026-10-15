import assert from 'node:assert/strict';
import test from 'node:test';
import { queryKeys } from '@/lib/query/keys';
import { invalidateLeaveMutationQueries } from './leave-mutation-invalidation.ts';

test('leave mutations invalidate leave data, balances, and calendar events', async () => {
  const invalidatedKeys: Array<readonly unknown[]> = [];
  const queryClient = {
    invalidateQueries: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
      invalidatedKeys.push(queryKey);
    },
  };

  await invalidateLeaveMutationQueries(queryClient);

  assert.deepEqual(invalidatedKeys, [
    queryKeys.leaves.all,
    queryKeys.leaves.balances,
    queryKeys.calendar.events,
  ]);
});
