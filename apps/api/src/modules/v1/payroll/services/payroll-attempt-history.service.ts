import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  PayrollFundingAttempt,
  type PayrollFundingAttemptStatus,
  type PayrollFundingPurpose,
} from '../entities/payroll-funding-attempt.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import {
  PayrollPayoutAttempt,
  type PayrollPayoutAttemptStatus,
} from '../entities/payroll-payout-attempt.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { FUNDING_TRANSITIONS, PAYOUT_TRANSITIONS } from './payroll-attempt-transitions';

@Injectable()
export class PayrollAttemptHistoryService {
  constructor(
    @InjectRepository(PayrollFundingAttempt)
    private readonly fundingAttempts: Repository<PayrollFundingAttempt>,
    @InjectRepository(PayrollPayoutAttempt)
    private readonly payoutAttempts: Repository<PayrollPayoutAttempt>,
    private readonly dataSource: DataSource,
  ) {}

  async beginFundingAttempt(
    input: {
      tenantId: string;
      payrollRunId: string;
      purpose: PayrollFundingPurpose;
      provider: string;
      orderReference: string;
      idempotencyKey: string;
      currency: string;
      amount: string;
      checkoutAmount?: string | null;
      balanceApplied?: string | null;
      selectedItemIds?: string[] | null;
      createdById?: string | null;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown> | null;
    },
    manager?: EntityManager,
  ): Promise<PayrollFundingAttempt> {
    if (manager) return this.createFundingAttempt(manager, input);
    return this.dataSource.transaction((transactionManager) =>
      this.createFundingAttempt(transactionManager, input),
    );
  }

  private async createFundingAttempt(
    manager: EntityManager,
    input: {
      tenantId: string;
      payrollRunId: string;
      purpose: PayrollFundingPurpose;
      provider: string;
      orderReference: string;
      idempotencyKey: string;
      currency: string;
      amount: string;
      checkoutAmount?: string | null;
      balanceApplied?: string | null;
      selectedItemIds?: string[] | null;
      createdById?: string | null;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<PayrollFundingAttempt> {
    const run = await manager
      .getRepository(PayrollRun)
      .createQueryBuilder('run')
      .setLock('pessimistic_write')
      .select(['run.id', 'run.tenantId'])
      .where('run.id = :payrollRunId AND run.tenantId = :tenantId', input)
      .getOne();
    if (!run) throw new Error('Payroll run does not belong to the funding attempt tenant.');

    const repo = manager.getRepository(PayrollFundingAttempt);
    const existing = await repo.findOne({
      where: {
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        purpose: input.purpose,
        provider: input.provider,
      },
    });
    if (existing) return existing;
    const previous = await repo.findOne({
      where: { tenantId: input.tenantId, payrollRunId: input.payrollRunId, purpose: input.purpose },
      order: { attemptNumber: 'DESC' },
      select: { attemptNumber: true },
    });
    const attempt = repo.create({
      ...input,
      attemptNumber: (previous?.attemptNumber ?? 0) + 1,
      status: 'pending',
      checkoutAmount: input.checkoutAmount ?? null,
      balanceApplied: input.balanceApplied ?? null,
      selectedItemIds: input.selectedItemIds ?? null,
      createdById: input.createdById ?? null,
      providerReference: null,
      confirmedAt: null,
      cancelledAt: null,
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ?? null,
    });
    return repo.save(attempt);
  }

  async findFundingAttemptByReference(input: {
    tenantId: string;
    reference: string;
  }): Promise<PayrollFundingAttempt | null> {
    return this.fundingAttempts
      .createQueryBuilder('attempt')
      .where('attempt.tenantId = :tenantId', input)
      .andWhere(
        '(attempt.orderReference = :reference OR attempt.providerReference = :reference)',
        input,
      )
      .orderBy('attempt.createdAt', 'DESC')
      .getOne();
  }

  async nextPayoutAttemptNumber(input: {
    tenantId: string;
    payrollItemId: string;
    provider: string;
  }): Promise<number> {
    const row = await this.payoutAttempts
      .createQueryBuilder('attempt')
      .select('COALESCE(MAX(attempt.attemptNumber), 0)', 'maximum')
      .where('attempt.tenantId = :tenantId', input)
      .andWhere('attempt.payrollItemId = :payrollItemId', input)
      .andWhere('attempt.provider = :provider', input)
      .getRawOne<{ maximum: string }>();
    return Number(row?.maximum ?? 0) + 1;
  }

  private lockFundingAttempt(
    manager: EntityManager,
    input: { tenantId: string; payrollRunId: string; provider: string; orderReference: string },
  ): Promise<PayrollFundingAttempt | null> {
    return manager
      .getRepository(PayrollFundingAttempt)
      .createQueryBuilder('attempt')
      .setLock('pessimistic_write')
      .where('attempt.tenant_id = :tenantId', input)
      .andWhere('attempt.payroll_run_id = :payrollRunId', input)
      .andWhere('attempt.provider = :provider', input)
      .andWhere(
        '(attempt.order_reference = :orderReference OR attempt.provider_reference = :orderReference)',
        input,
      )
      .getOne();
  }

  private runInTransaction<T>(
    manager: EntityManager | undefined,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return manager ? work(manager) : this.dataSource.transaction(work);
  }

  async transitionFundingAttempt(
    input: {
      tenantId: string;
      payrollRunId: string;
      provider: string;
      orderReference: string;
      status: PayrollFundingAttemptStatus;
      providerReference?: string | null;
    },
    manager?: EntityManager,
  ): Promise<PayrollFundingAttempt | null> {
    return this.runInTransaction(manager, async (tx) => {
      const repo = tx.getRepository(PayrollFundingAttempt);
      const attempt = await this.lockFundingAttempt(tx, input);
      if (!attempt) return null;
      if (
        attempt.status !== input.status &&
        !FUNDING_TRANSITIONS[attempt.status].has(input.status)
      ) {
        return attempt;
      }
      attempt.status = input.status;
      if (input.providerReference) attempt.providerReference = input.providerReference;
      if (input.status === 'confirmed') attempt.confirmedAt ??= new Date();
      if (input.status === 'cancelled' || input.status === 'expired') {
        attempt.cancelledAt ??= new Date();
      }
      return repo.save(attempt);
    });
  }

  async beginPayoutAttempt(
    input: {
      tenantId: string;
      payrollRunId: string;
      payrollItemId: string;
      provider: string;
      attemptNumber: number;
      merchantReference?: string | null;
      idempotencyKey: string;
      sourceAmount?: string | null;
      sourceCurrency?: string | null;
      destinationAmount: string;
      destinationCurrency: string;
      initialStatus?: PayrollPayoutAttemptStatus;
      metadata?: Record<string, unknown> | null;
    },
    manager?: EntityManager,
  ): Promise<PayrollPayoutAttempt> {
    if (manager) return this.createPayoutAttempt(manager, input);
    return this.dataSource.transaction((transactionManager) =>
      this.createPayoutAttempt(transactionManager, input),
    );
  }

  private async createPayoutAttempt(
    manager: EntityManager,
    input: {
      tenantId: string;
      payrollRunId: string;
      payrollItemId: string;
      provider: string;
      attemptNumber: number;
      merchantReference?: string | null;
      idempotencyKey: string;
      sourceAmount?: string | null;
      sourceCurrency?: string | null;
      destinationAmount: string;
      destinationCurrency: string;
      initialStatus?: PayrollPayoutAttemptStatus;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<PayrollPayoutAttempt> {
    const run = await manager.getRepository(PayrollRun).findOne({
      where: { id: input.payrollRunId, tenantId: input.tenantId },
      select: { id: true, tenantId: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!run) throw new Error('Payroll run does not belong to the payout attempt tenant.');
    const item = await manager.getRepository(PayrollItem).findOne({
      where: { id: input.payrollItemId, payrollRunId: input.payrollRunId },
      select: { id: true },
    });
    if (!item) throw new Error('Payroll item does not belong to the payout attempt run.');

    const repo = manager.getRepository(PayrollPayoutAttempt);
    const existing = await repo.findOne({
      where: {
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        payrollItemId: input.payrollItemId,
        provider: input.provider,
      },
    });
    if (existing) return existing;
    const { initialStatus, ...attemptInput } = input;
    const attempt = repo.create({
      ...attemptInput,
      status: initialStatus ?? 'created',
      providerReference: null,
      submittedAt: initialStatus === 'processing' ? new Date() : null,
      settledAt: null,
      sourceAmount: input.sourceAmount ?? null,
      sourceCurrency: input.sourceCurrency ?? null,
      merchantReference: input.merchantReference ?? null,
      metadata: input.metadata ?? null,
    });
    return repo.save(attempt);
  }

  async transitionPayoutAttempt(input: {
    tenantId: string;
    provider: string;
    merchantReference: string;
    status: PayrollPayoutAttemptStatus;
    providerReference?: string | null;
  }): Promise<PayrollPayoutAttempt | null> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayrollPayoutAttempt);
      const attempt = await repo
        .createQueryBuilder('attempt')
        .setLock('pessimistic_write')
        .where('attempt.tenant_id = :tenantId', input)
        .andWhere('attempt.provider = :provider', input)
        .andWhere('attempt.merchant_reference = :merchantReference', input)
        .getOne();
      if (!attempt) return null;
      if (
        attempt.status !== input.status &&
        !PAYOUT_TRANSITIONS[attempt.status].has(input.status)
      ) {
        return attempt;
      }
      attempt.status = input.status;
      if (input.providerReference) attempt.providerReference = input.providerReference;
      if (input.status === 'processing') attempt.submittedAt ??= new Date();
      if (input.status === 'payment_processed' || input.status === 'reversed') {
        attempt.settledAt ??= new Date();
      }
      return repo.save(attempt);
    });
  }
}
