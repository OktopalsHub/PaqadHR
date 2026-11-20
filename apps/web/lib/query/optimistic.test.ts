import assert from 'node:assert/strict';
import test from 'node:test';

import { QueryClient } from '@tanstack/react-query';

import { applyOptimisticUpdate, patchListItem } from './optimistic.ts';

test('patchListItem changes only the matching item and ignores non-lists', () => {
  const list = [
    { id: 'a', status: 'pending' },
    { id: 'b', status: 'pending' },
  ];
  assert.deepEqual(patchListItem(list, 'a', { status: 'approved' }), [
    { id: 'a', status: 'approved' },
    { id: 'b', status: 'pending' },
  ]);
  assert.equal(patchListItem(list, 'zzz', { status: 'x' }), list);
  const notAList = { not: 'a list' };
  assert.equal(patchListItem(notAList, 'a', {}), notAList);
});

test('applyOptimisticUpdate patches every matching query and rolls back exactly', async () => {
  const client = new QueryClient();
  client.setQueryData(['leaves', 't1', 'team', undefined], [{ id: 'a', status: 'pending' }]);
  client.setQueryData(['leaves', 't1', 'self', 5], [{ id: 'a', status: 'pending' }]);
  client.setQueryData(['other'], [{ id: 'a', status: 'pending' }]);

  const rollback = await applyOptimisticUpdate<{ id: string; status: string }[]>(
    client,
    ['leaves'],
    (data) => data.map((item) => ({ ...item, status: 'approved' })),
  );
  assert.equal(
    client.getQueryData<{ status: string }[]>(['leaves', 't1', 'team', undefined])?.[0]?.status,
    'approved',
  );
  assert.equal(
    client.getQueryData<{ status: string }[]>(['leaves', 't1', 'self', 5])?.[0]?.status,
    'approved',
  );
  assert.equal(client.getQueryData<{ status: string }[]>(['other'])?.[0]?.status, 'pending');

  rollback();
  assert.equal(
    client.getQueryData<{ status: string }[]>(['leaves', 't1', 'team', undefined])?.[0]?.status,
    'pending',
  );
  assert.equal(
    client.getQueryData<{ status: string }[]>(['leaves', 't1', 'self', 5])?.[0]?.status,
    'pending',
  );
});
