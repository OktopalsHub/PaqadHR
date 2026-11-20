import type { QueryClient, QueryKey } from '@tanstack/react-query';

type Snapshot = [QueryKey, unknown][];

/**
 * Applies `update` to every cached query under `queryKey`, so the UI reflects a
 * mutation before the server answers. Returns a function that puts back exactly
 * what was cached, for use when the request fails.
 */
export async function applyOptimisticUpdate<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (data: TData) => TData,
): Promise<() => void> {
  await queryClient.cancelQueries({ queryKey });
  const snapshot: Snapshot = queryClient
    .getQueriesData<TData>({ queryKey })
    .filter(([, data]) => data !== undefined);
  queryClient.setQueriesData<TData>({ queryKey }, (data) =>
    data === undefined ? data : update(data),
  );
  return () => {
    for (const [key, data] of snapshot) {
      queryClient.setQueryData(key, data);
    }
  };
}

/** Patches the items of a list whose `id` matches, leaving anything that is not a matching list untouched. */
export function patchListItem<TItem extends { id: string }>(
  data: unknown,
  id: string,
  patch: Partial<TItem>,
): unknown {
  if (!Array.isArray(data)) return data;
  let changed = false;
  const next = data.map((item) => {
    if (item && typeof item === 'object' && (item as { id?: unknown }).id === id) {
      changed = true;
      return { ...item, ...patch };
    }
    return item;
  });
  return changed ? next : data;
}

/**
 * Runs `refetch` only when this is the last in-flight mutation for the key, so
 * quick back-to-back changes do not overwrite each other with stale server data.
 */
export function isLastInFlightMutation(queryClient: QueryClient, mutationKey: QueryKey): boolean {
  return queryClient.isMutating({ mutationKey }) <= 1;
}
