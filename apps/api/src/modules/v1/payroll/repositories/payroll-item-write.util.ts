import type { QueryDeepPartialEntity, Repository } from 'typeorm';
import type { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { PayrollItem } from '../entities/payroll-item.entity';

/**
 * Restrict a `payroll_items` write to rows whose run belongs to `tenantId`.
 *
 * Never scope an UPDATE with `.innerJoin(...)`: TypeORM's UpdateQueryBuilder never emits a
 * join, so the tenant predicate is silently dropped and the `item` alias is undefined in the
 * UPDATE (Postgres rejects it with `missing FROM-clause entry for table "item"`). An
 * explicit subquery on the run keeps the predicate in the statement, so an item id that
 * belongs to another tenant matches no rows and cannot be written.
 */
const SCOPED_TO_TENANT_SQL =
  'payroll_run_id IN (SELECT run.id FROM payroll_runs run WHERE run.tenant_id = :tenantId)';

/** Tenant-scoped write of a single payroll item. */
export async function updatePayrollItemScoped(
  repo: Repository<PayrollItem>,
  itemId: string,
  tenantId: string,
  patch: QueryDeepPartialEntity<PayrollItem>,
): Promise<void> {
  await repo
    .createQueryBuilder('item')
    .update()
    .set(patch)
    .where('id = :itemId', { itemId })
    .andWhere(SCOPED_TO_TENANT_SQL, { tenantId })
    .execute();
}

/**
 * Conditionally claim items for payout and return the ids this caller actually won.
 * Tenant-scoped and guarded by `expectedStatus`, so two concurrent workers cannot both win.
 */
export async function claimPayrollItemsScoped(
  repo: Repository<PayrollItem>,
  itemIds: string[],
  tenantId: string,
  expectedStatus: PayrollItemStatus,
  patch: QueryDeepPartialEntity<PayrollItem>,
): Promise<string[]> {
  if (itemIds.length === 0) return [];

  const result = await repo
    .createQueryBuilder('item')
    .update()
    .set(patch)
    .where('id IN (:...itemIds)', { itemIds })
    .andWhere('status = :expectedStatus', { expectedStatus })
    .andWhere(SCOPED_TO_TENANT_SQL, { tenantId })
    .returning('id')
    .execute();

  const rows = (result.raw ?? []) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}
