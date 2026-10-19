import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { normalizePayoutStatus } from 'src/common/utils/normalize-payout-status.util';
import { paymentProviderLabel } from 'src/common/utils/resolve-payment-provider.util';
import { LessThan, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollFundingLedgerEventType } from '../entities/payroll-run-funding-ledger-entry.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollMerchantRef,
  parsePayrollMerchantRef,
} from '../utils/payroll-merchant-ref.util';
import type { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';
import type { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const PAYROLL_AMOUNT_TOLERANCE = 1;

/** How long a PROCESSING item with no provider transaction id may stay unqueried before
 * reconciliation declares it failed. Nothing was ever submitted for these, so the only
 * reason to wait is to let a slow provider error land first. */
const NULL_TRANSACTION_STUCK_GRACE_MS = 60 * 60 * 1000;

/**
 * How far back the paid-item Bachs debit sweep looks. Older rows are left alone: either the
 * ledger write succeeded, or the provider no longer returns the evidence needed to repair it,
 * and re-querying that history on every run only burns provider rate limit.
 */
const BACHS_DEBIT_RECOVERY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** Page size for the paid-item debit sweep. */
const BACHS_DEBIT_RECOVERY_PAGE_SIZE = 50;

const SUCCESS_STATUSES = new Set([
  'SUCCESS',
  'SUCCESSFUL',
  'COMPLETED',
  'PAYMENT_SUCCESSFUL',
  'SUCCEEDED',
  'PAID',
  'SETTLED',
]);
const PENDING_STATUSES = new Set([
  'PENDING',
  'PENDING_BILLING',
  'PROCESSING',
  'IN_PROGRESS',
  'PENDING_AUTHORIZATION',
  'AWAITING_AUTHORIZATION',
  'AWAITING_PROCESSING',
]);
const FAILED_STATUSES = new Set([
  'FAILED',
  'REFUND',
  'REVERSED',
  'CANCELLED',
  'CANCELED',
  'REJECTED',
]);

@Injectable()
export class PayoutReconciliation {
  private readonly logger = new Logger(PayoutReconciliation.name);

  constructor(
    private readonly fincraApi: FincraApiService,
    private readonly factory: PaymentProviderFactoryService,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
    private readonly lifecycleNotify?: PayrollLifecycleNotifyService,
    private readonly fundingLedger?: PayrollRunFundingLedgerService,
  ) {}

  async resolveTenantId(payrollRunId: string): Promise<string | undefined> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId },
      select: ['tenantId'],
    });
    return run?.tenantId;
  }

  /**
   * True when the provider string persisted on an item resolves to `provider`.
   *
   * Items store `paymentProvider` as the display label (for example "Bachs transfer"), while
   * webhook and query paths pass a `PaymentProvider`. Comparing the raw strings (or the label)
   * silently skips recovery, so always compare through the resolver.
   */
  private isSameProvider(stored: string | null | undefined, provider: PaymentProvider): boolean {
    return (stored ?? '').trim().length > 0 && this.resolveStoredProvider(stored) === provider;
  }

  resolveStoredProvider(stored: string | null | undefined): PaymentProvider {
    const value = (stored ?? '').toLowerCase();
    if (value.includes('fincra')) return PaymentProvider.FINCRA;
    if (value.includes('bachs')) return PaymentProvider.BACHS;
    if (value.includes('noah') || value.includes('international') || value.includes('crypto'))
      return PaymentProvider.NOAH;
    if (value.includes('monnify')) return PaymentProvider.MONNIFY;
    return PaymentProvider.NOMBA;
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    // Sweep tenant-by-tenant rather than selecting every PROCESSING row in the instance.
    // A bare status+updatedAt filter has no tenant predicate, so it reads (and can notify
    // about) payroll items belonging to any tenant on this instance — a cross-tenant data
    // exposure. Each tenant is resolved from its own runs, then queried with an explicit
    // tenant_id predicate so no item is ever loaded outside its owner.
    const tenantIds =
      await this.payrollRunRepository.findDistinctTenantIdsWithProcessingItems(cutoff);

    let updated = 0;
    let checked = 0;

    for (const tenantId of tenantIds) {
      try {
        const stuckItems = await this.payrollItemRepo.find({
          where: {
            status: PayrollItemStatus.PROCESSING,
            updatedAt: LessThan(cutoff),
            payrollRun: { tenantId },
          },
          // Load the relations the failure notification reads: without `employee` the email falls
          // back to a raw member UUID, and without `payrollRun` every item costs an extra
          // resolveTenantId round trip.
          relations: ['employee', 'payrollRun'],
          take: 50,
        });
        checked += stuckItems.length;

        for (const item of stuckItems) {
          const changed = await this.reconcileStuckItem(item, tenantId);
          if (changed) updated += 1;
        }
      } catch (error) {
        // One tenant's rows must not abort the sweep for every other tenant, and a failed
        // sweep must still report what it managed to check.
        this.logger.warn(
          `Stuck payout sweep failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Payroll status and ledger writes are separate operations. If the provider confirms a
    // payout after the item was marked PAID but the ledger write failed, no PROCESSING sweep
    // will ever see it again. Periodically scan paid Bachs items for a missing debit and let
    // applyTransferStatus re-query Bachs before attempting the idempotent ledger write.
    if (this.fundingLedger) {
      const paidTenantIds =
        await this.payrollRunRepository.findDistinctTenantIdsWithPaidBachsItems();
      const recoverySince = new Date(Date.now() - BACHS_DEBIT_RECOVERY_WINDOW_MS);
      for (const tenantId of paidTenantIds) {
        try {
          // Keyset pagination, not OFFSET: a repaired item drops out of the NOT EXISTS filter,
          // so offset paging would skip candidates on the next page. The cursor is stable
          // because updatedAt/id never change while this sweep runs.
          let cursor: { updatedAt: Date; id: string } | null = null;
          while (true) {
            const paidItems = await this.findPaidBachsItemsMissingDebit(
              tenantId,
              recoverySince,
              cursor,
            );
            checked += paidItems.length;

            for (const item of paidItems) {
              if (!item.transactionId) continue;
              try {
                const retryAttempt =
                  typeof item.metadata?.payoutRetryCount === 'number'
                    ? item.metadata.payoutRetryCount
                    : 0;
                const merchantRef = buildPayrollMerchantRef(
                  item.payrollRunId,
                  item.id,
                  retryAttempt,
                );
                await this.applyTransferStatus(
                  merchantRef,
                  'COMPLETED',
                  item.transactionId,
                  PaymentProvider.BACHS,
                  tenantId,
                );
              } catch (error) {
                this.logger.warn(
                  `Could not reconcile missing Bachs ledger debit for payroll item ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }

            const last = paidItems[paidItems.length - 1];
            if (paidItems.length < BACHS_DEBIT_RECOVERY_PAGE_SIZE || !last?.updatedAt) break;
            cursor = { updatedAt: last.updatedAt, id: last.id };
          }
        } catch (error) {
          // A single tenant's sweep failure must not leave every other tenant unrecovered.
          this.logger.warn(
            `Bachs debit recovery sweep failed for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return { checked, updated };
  }

  /**
   * Paid Bachs items in one tenant that still have no confirmed ledger debit.
   *
   * The NOT EXISTS filter runs in Postgres: without it every sweep loaded the tenant's full
   * paid history and issued one `hasConfirmedPayoutDebit` query per row (N+1), then queried
   * Bachs again for rows recovery can never fix. The recovery window keeps legacy and
   * long-settled history out of the provider path entirely.
   */
  private async findPaidBachsItemsMissingDebit(
    tenantId: string,
    recoverySince: Date,
    cursor: { updatedAt: Date; id: string } | null,
  ): Promise<PayrollItem[]> {
    const query = this.payrollItemRepo
      .createQueryBuilder('paid_item')
      .innerJoinAndSelect('paid_item.payrollRun', 'run', 'run.tenantId = :tenantId', { tenantId })
      .where('paid_item.status = :paidStatus', { paidStatus: PayrollItemStatus.PAID })
      .andWhere('LOWER(paid_item.payment_provider) LIKE :bachsProvider', {
        bachsProvider: '%bachs%',
      })
      .andWhere('paid_item.transaction_id IS NOT NULL')
      .andWhere('COALESCE(paid_item.paid_at, paid_item.updated_at) >= :recoverySince', {
        recoverySince,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payroll_run_funding_ledger ledger
          WHERE ledger.payroll_item_id = paid_item.id
            AND ledger.payroll_run_id = paid_item.payroll_run_id
            AND ledger.event_type = :confirmedDebit
        )`,
        { confirmedDebit: PayrollFundingLedgerEventType.PAYOUT_CONFIRMED },
      )
      // Order by entity property paths, not database column names. This query paginates over a
      // join, so TypeORM resolves the order-by through entity metadata in its distinct-alias
      // path; a column name such as `updated_at` resolves to no property and the sweep throws
      // "Cannot read properties of undefined (reading 'databaseName')".
      .orderBy('paid_item.updatedAt', 'ASC')
      .addOrderBy('paid_item.id', 'ASC')
      .take(BACHS_DEBIT_RECOVERY_PAGE_SIZE);

    if (cursor) {
      query.andWhere('(paid_item.updated_at, paid_item.id) > (:cursorUpdatedAt, :cursorId)', {
        cursorUpdatedAt: cursor.updatedAt,
        cursorId: cursor.id,
      });
    }

    return query.getMany();
  }

  /** Reconcile one stuck item inside its own tenant scope. Returns true when it transitioned. */
  private async reconcileStuckItem(item: PayrollItem, tenantId: string): Promise<boolean> {
    const reference = item.transactionId;
    if (!reference) {
      // No provider reference means no payout was ever submitted, so no status query and
      // no webhook can ever move this item. Left alone it traps the run in APPROVED
      // forever, so fail it once the grace window has passed.
      return this.failNullTransactionStuckItem(item);
    }

    const retryAttempt =
      typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
    const provider = this.resolveStoredProvider(item.paymentProvider);
    const querier = this.factory.resolvePayoutQuerier(provider);

    let status: string | null = null;
    let amount: number | undefined;

    if (querier) {
      const result = await querier.queryStatus(reference, merchantRef);
      if (result) {
        status = result.status;
        amount = result.amount;
      }
    }

    if (!status) return false;

    if (
      provider === PaymentProvider.BACHS &&
      this.fundingLedger &&
      new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']).has(status.trim().toUpperCase())
    ) {
      await this.fundingLedger.releaseFailedPayoutReservationsForItem({
        tenantId,
        payrollRunId: item.payrollRunId,
        payrollItemId: item.id,
        provider: PaymentProvider.BACHS,
        providerReference: reference,
        evidence: {
          verifiedStatus: status.trim().toUpperCase(),
          merchantReference: merchantRef,
          verificationSource: 'provider_status_query',
        },
      });
    }

    const changed = await this.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) {
      await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
    }
    return changed;
  }

  /**
   * A PROCESSING item with no provider transaction id cannot be requeried, so after the
   * grace window we fail it so the run can leave APPROVED and the admin sees the rejection.
   *
   * "No transaction id" does NOT prove "never submitted": a provider can accept the payout
   * and lose the response. Such items are flagged with `payoutSubmissionPending`, and they
   * are left in PROCESSING on purpose — failing one makes it retryable, and the retry mints a
   * fresh merchant reference (and therefore a fresh idempotency key), which the provider
   * cannot dedupe. Waiting for the payout webhook is the only safe terminal signal.
   *
   * Returns true when the item transitioned.
   */
  private async failNullTransactionStuckItem(item: PayrollItem): Promise<boolean> {
    if (item.metadata?.payoutSubmissionPending === true) {
      this.logger.warn(
        `Payroll item ${item.id} has an unknown payout submission outcome; leaving it PROCESSING for webhook resolution`,
      );
      return false;
    }

    const graceCutoff = new Date(Date.now() - NULL_TRANSACTION_STUCK_GRACE_MS);
    if (!item.updatedAt || item.updatedAt >= graceCutoff) return false;

    const tenantId = item.payrollRun?.tenantId ?? (await this.resolveTenantId(item.payrollRunId));
    if (!tenantId) return false;

    const reason =
      item.failureReason?.trim() || 'Payout was never submitted to the payment provider';

    // Fail only if the row is still PROCESSING. The synchronous payout path can mark the item
    // FAILED (and notify) while this sweep is between its SELECT and this UPDATE, so an
    // unconditional write would send a second failure email for the same item.
    const failed = await updatePayrollItemScopedIfStatus(
      this.payrollItemRepo,
      item.id,
      tenantId,
      PayrollItemStatus.PROCESSING,
      {
        status: PayrollItemStatus.FAILED,
        failureReason: reason,
      },
    );
    if (!failed) {
      this.logger.warn(
        `Payroll item ${item.id} was already resolved before the reconciliation sweep could fail it`,
      );
      return false;
    }

    this.logger.warn(
      `Payroll item ${item.id} stuck in PROCESSING with no provider payout; failing it`,
    );

    item.status = PayrollItemStatus.FAILED;
    item.failureReason = reason;
    if (this.lifecycleNotify) {
      await this.lifecycleNotify.onItemFailed({
        tenantId,
        item,
        run: item.payrollRun,
        reason,
        auditContext: {
          tenantId,
          payrollRunId: item.payrollRunId,
          performedById: item.payrollRun?.createdById ?? item.memberId,
          memberId: item.memberId,
        },
      });
    }

    await this.reconcilePayrollRunStatus(item.payrollRunId, tenantId);
    return true;
  }

  async reconcileFailedItemBeforeRetry(item: PayrollItem, tenantId: string): Promise<boolean> {
    const provider = this.resolveStoredProvider(item.paymentProvider);
    const retryAttempt =
      typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;

    if (provider === PaymentProvider.FINCRA) {
      try {
        for (let attempt = 0; attempt <= retryAttempt; attempt++) {
          const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, attempt);
          const verified = await this.fincraApi.getPayoutStatus(merchantRef);
          if (!verified) continue;

          const status = verified.status.toUpperCase();
          if (SUCCESS_STATUSES.has(status) || PENDING_STATUSES.has(status)) {
            await this.applyTransferStatus(
              merchantRef,
              status,
              verified.reference ?? item.transactionId ?? merchantRef,
              PaymentProvider.FINCRA,
              tenantId,
              verified.amount,
            );
            return false;
          }
        }

        const latestRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
        const latest = await this.fincraApi.getPayoutStatus(latestRef);
        if (!latest) return true;
        return !FAILED_STATUSES.has(latest.status.toUpperCase());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Fincra status lookup failed (${message})`,
        );
      }
    }

    const merchantRef = buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt);
    const reference = item.transactionId?.trim();
    // A retry mints a new merchant reference, so anything already submitted under the
    // previous one stays a live payout. Items whose submission outcome we never learned
    // must not be retried blind — that is how an employee gets paid twice.
    if (provider === PaymentProvider.BACHS && !reference) {
      // Bachs only omits the merchant reference when it never received the payout, so
      // there is no live payout to double-pay and the retry is safe. Any other missing
      // reference is an unknown submission and stays blocked.
      if (item.metadata?.payoutNeverSubmitted === true) {
        return true;
      }
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: Bachs has not provided a payout reference to verify a terminal failure.`,
      );
    }
    if (!reference && item.metadata?.payoutSubmissionPending === true) {
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: its payout submission outcome is still unknown. ` +
          'Wait for the provider to confirm the payout before retrying.',
      );
    }
    if (!reference) return true;

    const querier = this.factory.resolvePayoutQuerier(provider);
    let status: string | null = null;
    let amount: number | undefined;

    if (querier) {
      const result = await querier.queryStatus(reference, merchantRef);
      if (result) {
        status = result.status;
        amount = result.amount;
      }
    }

    if (provider === PaymentProvider.BACHS) {
      const terminalFailureStatuses = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED']);
      const verifiedStatus = status?.trim().toUpperCase();
      if (!verifiedStatus) {
        throw new BadRequestException(
          `Cannot retry payroll item ${item.id}: Bachs could not verify its payout status. Try again after provider status is available.`,
        );
      }
      if (terminalFailureStatuses.has(verifiedStatus)) {
        if (this.fundingLedger) {
          await this.fundingLedger.releaseFailedPayoutReservationsForItem({
            tenantId,
            payrollRunId: item.payrollRunId,
            payrollItemId: item.id,
            provider: PaymentProvider.BACHS,
            providerReference: reference,
            evidence: {
              verifiedStatus,
              merchantReference: merchantRef,
              verificationSource: 'provider_status_query',
            },
          });
        }
        return true;
      }
      if (SUCCESS_STATUSES.has(verifiedStatus) || PENDING_STATUSES.has(verifiedStatus)) {
        await this.applyTransferStatus(
          merchantRef,
          verifiedStatus,
          reference,
          provider,
          tenantId,
          amount,
        );
        return false;
      }
      throw new BadRequestException(
        `Cannot retry payroll item ${item.id}: Bachs returned non-terminal payout status "${verifiedStatus}".`,
      );
    }

    if (!status) return true;

    const changed = await this.applyTransferStatus(
      merchantRef,
      status,
      reference,
      provider,
      tenantId,
      amount,
    );
    if (changed) return FAILED_STATUSES.has(status.toUpperCase());
    return FAILED_STATUSES.has(status.toUpperCase());
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
    provider: PaymentProvider = PaymentProvider.NOMBA,
    tenantId?: string,
    amount?: number,
  ): Promise<boolean> {
    const parsed = parsePayrollMerchantRef(merchantRef);
    if (!parsed) return false;

    const { payrollRunId, payrollItemId: itemId } = parsed;
    const status = rawStatus.toUpperCase();
    const normalizedStatus = normalizePayoutStatus(provider, rawStatus);
    const providerName = paymentProviderLabel(provider);
    if (!normalizedStatus) {
      this.logger.warn(`Unknown ${providerName} payout status: ${rawStatus}`);
      return false;
    }
    const resolvedTenantId = tenantId ?? (await this.resolveTenantId(payrollRunId ?? ''));
    // A FAILED item may still represent a payout that Bachs completed while PaqadHR
    // was processing a failure webhook. Only permit that recovery after a fresh provider
    // lookup confirms both the exact merchant reference and a terminal success status.
    let verifiedFailedBachsSuccess = false;
    if (provider === PaymentProvider.BACHS && normalizedStatus === 'completed') {
      const existingItem = await this.payrollItemRepo.findOne({
        where: {
          id: itemId,
          ...(payrollRunId ? { payrollRunId } : {}),
          ...(resolvedTenantId ? { payrollRun: { tenantId: resolvedTenantId } } : {}),
        },
        relations: ['payrollRun'],
      });
      if (
        existingItem?.status === PayrollItemStatus.FAILED &&
        existingItem.transactionId === transactionId &&
        this.isSameProvider(existingItem.paymentProvider, provider)
      ) {
        const querier = this.factory.resolvePayoutQuerier(PaymentProvider.BACHS);
        const payout = await querier?.queryStatus(transactionId, merchantRef);
        const verifiedStatus = payout?.status?.trim().toUpperCase();
        verifiedFailedBachsSuccess =
          payout?.reference === merchantRef &&
          !!verifiedStatus &&
          SUCCESS_STATUSES.has(verifiedStatus);
        if (!verifiedFailedBachsSuccess) {
          this.logger.warn(
            `Bachs success could not be verified for failed payroll item ${itemId}; leaving it failed`,
          );
        }
      }
    }

    const outcome: { item: PayrollItem | null; kind: 'paid' | 'failed' | null } = {
      item: null,
      kind: null,
    };

    const changed = await this.payrollItemRepo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PayrollItem);
      const where: Record<string, unknown> = { id: itemId };
      if (payrollRunId) where.payrollRunId = payrollRunId;

      if (payrollRunId && resolvedTenantId) {
        const payrollRun = await manager.getRepository(PayrollRun).findOne({
          where: { id: payrollRunId, tenantId: resolvedTenantId },
          select: ['id', 'tenantId'],
        });
        if (!payrollRun) return false;
      }

      // Lock only the payroll_item row. Loading relations here generates LEFT OUTER JOINs,
      // and PostgreSQL rejects FOR UPDATE when it would also lock the nullable side.
      const item = await repository.findOne({
        where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!item) return false;

      if (normalizedStatus === 'completed') {
        if (item.status === PayrollItemStatus.PAID) {
          // A repeated provider success must not notify or mutate payroll state again.
          // Keep the persisted item available to the ledger-recovery step below, but only
          // when this success belongs to the exact payout already recorded on the item.
          if (
            provider === PaymentProvider.BACHS &&
            this.isSameProvider(item.paymentProvider, provider) &&
            item.transactionId === transactionId
          ) {
            outcome.item = item;
            outcome.kind = 'paid';
          }
          return false;
        }
        if (
          item.metadata?.fxAtPayout !== true &&
          amount != null &&
          Number.isFinite(amount) &&
          Math.abs(Number(amount) - Number(item.paymentAmount)) > PAYROLL_AMOUNT_TOLERANCE
        ) {
          this.logger.error(
            `Payroll amount mismatch for item ${itemId}: expected ${item.paymentAmount}, got ${amount}; leaving PROCESSING`,
          );
          if (item.status !== PayrollItemStatus.PENDING) return false;
          item.status = PayrollItemStatus.PROCESSING;
          item.transactionId = transactionId;
          item.paymentProvider = providerName;
          await repository.save(item);
          return true;
        }

        if (
          item.status !== PayrollItemStatus.PENDING &&
          item.status !== PayrollItemStatus.PROCESSING &&
          !(
            item.status === PayrollItemStatus.FAILED &&
            verifiedFailedBachsSuccess &&
            provider === PaymentProvider.BACHS &&
            item.transactionId === transactionId &&
            this.isSameProvider(item.paymentProvider, provider)
          )
        ) {
          return false;
        }
        item.status = PayrollItemStatus.PAID;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.paidAt = new Date();
        item.failureReason = null;
        await repository.save(item);
        outcome.item = await repository.findOne({
          where: { id: item.id },
          relations: ['payrollRun', 'employee'],
        });
        outcome.kind = 'paid';
        return true;
      }

      if (normalizedStatus === 'failed') {
        if (item.status === PayrollItemStatus.FAILED || item.status === PayrollItemStatus.PAID) {
          return false;
        }
        if (
          item.status !== PayrollItemStatus.PENDING &&
          item.status !== PayrollItemStatus.PROCESSING
        ) {
          return false;
        }
        item.status = PayrollItemStatus.FAILED;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.failureReason = `${providerName} ${status.toLowerCase()}`;
        await repository.save(item);
        outcome.item = await repository.findOne({
          where: { id: item.id },
          relations: ['payrollRun', 'employee'],
        });
        outcome.kind = 'failed';
        this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
        return true;
      }

      if (normalizedStatus === 'processing') {
        if (item.status !== PayrollItemStatus.PENDING && item.status !== PayrollItemStatus.FAILED) {
          return false;
        }
        item.status = PayrollItemStatus.PROCESSING;
        item.transactionId = transactionId;
        item.paymentProvider = providerName;
        item.failureReason = null;
        await repository.save(item);
        return true;
      }

      return false;
    });

    const changedItem = outcome.item;
    const changedKind = outcome.kind;
    if (changed && changedItem && resolvedTenantId && this.lifecycleNotify) {
      if (changedKind === 'paid') {
        await this.lifecycleNotify.onItemPaid({
          tenantId: resolvedTenantId,
          item: changedItem,
          run: changedItem.payrollRun,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: changedItem.payrollRunId,
            performedById: changedItem.payrollRun?.createdById ?? changedItem.memberId,
            memberId: changedItem.memberId,
          },
        });
      } else if (changedKind === 'failed') {
        await this.lifecycleNotify.onItemFailed({
          tenantId: resolvedTenantId,
          item: changedItem,
          run: changedItem.payrollRun,
          reason: changedItem.failureReason ?? `${providerName} ${status.toLowerCase()}`,
          auditContext: {
            tenantId: resolvedTenantId,
            payrollRunId: changedItem.payrollRunId,
            performedById: changedItem.payrollRun?.createdById ?? changedItem.memberId,
            memberId: changedItem.memberId,
          },
        });
      }
    }

    // A compact `pi_...` merchant ref does not encode the run id, so resolve it from the item
    // that was just confirmed paid. Without this the ledger recovery is unreachable for the
    // ref format we actually mint, and a paid item can stay without its confirmed debit.
    const debitPayrollRunId = parsed.payrollRunId ?? outcome.item?.payrollRunId ?? null;

    if (
      changedKind === 'paid' &&
      outcome.item?.status === PayrollItemStatus.PAID &&
      outcome.item.transactionId === transactionId &&
      provider === PaymentProvider.BACHS &&
      debitPayrollRunId &&
      resolvedTenantId &&
      this.fundingLedger
    ) {
      try {
        // Query the provider even for repeated success events. This repairs the case where
        // the payroll state committed but the separate ledger write failed on an earlier
        // webhook. The ledger service makes this write idempotent.
        const querier = this.factory.resolvePayoutQuerier(PaymentProvider.BACHS);
        const payout = await querier?.queryStatus(transactionId, merchantRef);
        const verifiedStatus = payout?.status?.trim().toUpperCase();
        const terminalSuccessStatuses = new Set([
          'SUCCESS',
          'SUCCESSFUL',
          'SUCCEEDED',
          'COMPLETED',
          'PAID',
          'SETTLED',
          'ACCEPTED',
        ]);
        const referenceMatches = payout?.reference === merchantRef;
        if (
          payout &&
          referenceMatches &&
          verifiedStatus &&
          terminalSuccessStatuses.has(verifiedStatus) &&
          payout.sourceDebitedAmount != null &&
          Number.isFinite(payout.sourceDebitedAmount) &&
          payout.sourceDebitedAmount > 0 &&
          payout.sourceCurrency
        ) {
          await this.fundingLedger.recordConfirmedPayoutDebit({
            tenantId: resolvedTenantId,
            payrollRunId: debitPayrollRunId,
            payrollItemId: itemId,
            amount: payout.sourceDebitedAmount,
            currency: payout.sourceCurrency,
            provider: PaymentProvider.BACHS,
            providerReference: transactionId,
            evidence: {
              verifiedStatus,
              merchantReference: merchantRef,
              destinationAmount: amount ?? null,
              sourceDebitedAmount: payout.sourceDebitedAmount,
              sourceCurrency: payout.sourceCurrency,
            },
          });
        } else {
          this.logger.warn(
            `Bachs payout ${transactionId} completed but provider reference, terminal status, or source debit could not be verified; ledger recovery remains pending`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Could not record verified Bachs debit for payroll item ${itemId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return changed;
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    const status = (rawStatus ?? '').toUpperCase();
    if (SUCCESS_STATUSES.has(status)) return 'paid';
    if (FAILED_STATUSES.has(status)) return 'failed';
    return 'processing';
  }

  async reconcilePayrollRunStatus(payrollRunId: string, tenantId: string): Promise<void> {
    const run = await this.payrollRunRepository.findByIdWithItems(payrollRunId, tenantId);
    if (!run) return;
    const items = run.items;
    if (items.length === 0) return;

    const approvedAt = run.metadata?.approvedAt;
    const postApproval =
      (typeof approvedAt === 'string' && approvedAt.length > 0) ||
      run.status === PayrollStatus.APPROVED ||
      run.status === PayrollStatus.COMPLETED ||
      run.status === PayrollStatus.FAILED;
    if (!postApproval) {
      return;
    }

    let pending = 0;
    let processing = 0;
    let paid = 0;
    let failed = 0;
    let cancelled = 0;

    for (const item of items) {
      switch (item.status) {
        case PayrollItemStatus.PENDING:
          pending += 1;
          break;
        case PayrollItemStatus.PROCESSING:
          processing += 1;
          break;
        case PayrollItemStatus.PAID:
          paid += 1;
          break;
        case PayrollItemStatus.FAILED:
          failed += 1;
          break;
        case PayrollItemStatus.CANCELLED:
          cancelled += 1;
          break;
        default:
          break;
      }
    }

    const active = items.length - cancelled;
    if (active <= 0) {
      run.status = PayrollStatus.CANCELLED;
      await this.payrollRunRepository.save(run);
      return;
    }

    const _inFlight = pending + processing;

    run.status = resolvePostApprovalPayrollStatus({
      pending,
      processing,
      paid,
      failed,
      active,
    });
    if (run.status === PayrollStatus.COMPLETED) {
      run.processedAt = run.processedAt ?? new Date();
    }

    await this.payrollRunRepository.save(run);
  }
}

/** Post-approval run status from item counts. Never returns `processing` (that means pre-approve). */
export function resolvePostApprovalPayrollStatus(counts: {
  pending: number;
  processing: number;
  paid: number;
  failed: number;
  active: number;
}): PayrollStatus {
  const inFlight = counts.pending + counts.processing;
  if (counts.active <= 0) return PayrollStatus.CANCELLED;
  if (inFlight > 0) return PayrollStatus.APPROVED;
  if (counts.paid === counts.active) return PayrollStatus.COMPLETED;
  if (counts.failed === counts.active) return PayrollStatus.FAILED;
  if (counts.paid > 0 && counts.failed > 0) return PayrollStatus.APPROVED;
  if (counts.paid > 0) return PayrollStatus.COMPLETED;
  return PayrollStatus.FAILED;
}
