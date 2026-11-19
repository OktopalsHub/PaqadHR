import { Injectable, Optional } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { PayrollFundingAttempt } from '../entities/payroll-funding-attempt.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { type FloatTopupMeta, readFloatTopupMeta } from '../utils/payroll-funding-meta.util';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';

@Injectable()
export class PayrollFloatTopupRunService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    @Optional() private readonly attemptHistory?: PayrollAttemptHistoryService,
  ) {}

  async findRunForTopup(input: {
    tenantId: string;
    orderReference: string;
    payrollRunId?: string;
  }): Promise<{
    run: PayrollRun | null;
    attempt: PayrollFundingAttempt | null;
  }> {
    const attempt = await this.attemptHistory?.findFundingAttemptByReference({
      tenantId: input.tenantId,
      reference: input.orderReference,
    });
    if (input.payrollRunId) {
      const run = await this.payrollRunRepository.findOne({
        where: { id: input.payrollRunId, tenantId: input.tenantId },
      });
      return {
        run,
        attempt:
          attempt &&
          attempt.payrollRunId === input.payrollRunId &&
          attempt.tenantId === input.tenantId
            ? attempt
            : null,
      };
    }
    if (attempt) {
      return {
        run: await this.payrollRunRepository.findOne({
          where: { id: attempt.payrollRunId, tenantId: input.tenantId },
        }),
        attempt,
      };
    }

    return {
      run: await this.payrollRunRepository
        .createQueryBuilder('run')
        .where('run.tenantId = :tenantId', { tenantId: input.tenantId })
        .andWhere(
          `((run.metadata::jsonb -> 'floatTopup' ->> 'orderReference') = :ref OR (run.metadata::jsonb -> 'floatTopup' -> 'references') @> to_jsonb(:ref::text))`,
          { ref: input.orderReference },
        )
        .getOne(),
      attempt: null,
    };
  }

  /**
   * Atomically mark float top-up completed. Returns the locked run when this caller wins the claim;
   * null when another delivery already completed the same orderReference.
   */
  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.payrollRunRepository.manager.transaction(work);
  }

  async claimFloatTopupCompleted(
    input: {
      runId: string;
      tenantId: string;
      orderReference: string;
      shortfall?: number;
      provider: string;
      fundingCurrency?: string;
    },
    outer?: EntityManager,
  ): Promise<PayrollRun | null> {
    const work = async (manager: EntityManager) => {
      const locked = await manager
        .getRepository(PayrollRun)
        .createQueryBuilder('run')
        .setLock('pessimistic_write')
        .where('run.id = :id', { id: input.runId })
        .andWhere('run.tenantId = :tenantId', { tenantId: input.tenantId })
        .getOne();
      if (!locked) return null;

      const meta = readFloatTopupMeta(locked);
      const known = [meta.orderReference, ...(meta.references ?? [])].filter(
        (reference): reference is string => Boolean(reference),
      );
      if (!known.includes(input.orderReference)) {
        return null;
      }
      if (meta.status === 'completed') {
        return null;
      }

      locked.metadata = {
        ...locked.metadata,
        floatTopup: {
          orderReference: input.orderReference,
          status: 'completed',
          completedAt: new Date().toISOString(),
          shortfall: input.shortfall ?? meta.shortfall,
          provider: input.provider,
          fundingCurrency: input.fundingCurrency ?? meta.fundingCurrency,
          references: [
            ...new Set(
              [meta.orderReference, ...(meta.references ?? [])].filter(
                (reference): reference is string => Boolean(reference),
              ),
            ),
          ]
            .filter((reference) => reference !== input.orderReference)
            .slice(-5),
        } satisfies FloatTopupMeta,
      };
      await manager.save(locked);
      return locked;
    };
    return outer ? work(outer) : this.payrollRunRepository.manager.transaction(work);
  }
}
