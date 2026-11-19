import type { FindOptionsRelations } from 'typeorm';

/**
 * TypeORM 1.x only accepts the object form of `relations`. Repository helpers that take a
 * caller-supplied list of relation paths (`'requester.user'`) convert it here.
 */
export function relationsFromPaths<T>(
  paths?: readonly string[] | null,
): FindOptionsRelations<T> | undefined {
  if (!paths?.length) return undefined;
  const tree: Record<string, unknown> = {};
  for (const path of paths) {
    let node = tree;
    for (const segment of path.split('.')) {
      const existing = node[segment];
      if (typeof existing === 'object' && existing !== null) {
        node = existing as Record<string, unknown>;
        continue;
      }
      const created: Record<string, unknown> = {};
      node[segment] = created;
      node = created;
    }
  }
  const mark = (node: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(node).map(([key, child]) => [
        key,
        Object.keys(child as object).length ? mark(child as Record<string, unknown>) : true,
      ]),
    );
  return mark(tree) as FindOptionsRelations<T>;
}
