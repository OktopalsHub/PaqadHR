import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isNombaConfigured } from 'src/common/config/nomba.config';
import { PaymentResult } from 'src/common/interfaces/payment-result.interface';
import { In, Repository } from 'typeorm';

import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { calculatePayrollPlatformFee } from '../utils/payroll-platform-fee.util';
import { NombaPayOneOps } from './nomba-pay-one.ops';
import {
  hasConfirmedNombaFeeConfiguration,
  isVerifiedNgnDestination,
  NOMBA_BATCH_SIZE,
} from './nomba-payroll-payout.shared';
import { PayrollFeeService } from './payroll-fee.service';

export class NombaRunOps {
  constructor(
    private readonly payrollFees: PayrollFeeService,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethods: Repository<PaymentMethod>,
    private readonly payOne: NombaPayOneOps,
  ) {}

  async assessRunReadiness(
    items: PayrollItem[],
    tenantId: string,
  ): Promise<
    Map<
      string,
      { ready: boolean; message?: string; platformFeeAmount: string; platformFeePercentage: number }
    >
  > {
    const result = new Map<
      string,
      { ready: boolean; message?: string; platformFeeAmount: string; platformFeePercentage: number }
    >();
    const ngnItems = items.filter((item) => item.paymentCurrency?.toUpperCase() === 'NGN');
    if (!ngnItems.length) return result;

    const platformFeePercentage = await this.payrollFees.getPayrollFeePercentage(tenantId);

    if (
      !isNombaConfigured() ||
      process.env.NOMBA_PAYROLL_NGN_ENABLED !== 'true' ||
      !hasConfirmedNombaFeeConfiguration()
    ) {
      for (const item of ngnItems) {
        result.set(item.id, {
          ready: false,
          message:
            'Nomba NGN payroll payouts require credentials, an enabled route, and the Nomba per-transfer fee confirmed for this account.',
          platformFeeAmount: '0',
          platformFeePercentage,
        });
      }
      return result;
    }

    const methodIds = [...new Set(ngnItems.map((item) => item.paymentMethodId).filter(Boolean))];
    const methods = methodIds.length
      ? await this.paymentMethods.find({
          where: { id: In(methodIds), tenantId },
          select: {
            id: true,
            memberId: true,
            currency: true,
            country: true,
            bankCode: true,
            accountNumber: true,
            accountName: true,
            status: true,
            type: true,
          },
        })
      : [];
    for (const method of methods) {
      this.payOne.decryptBankDetails(method);
    }
    const methodById = new Map(methods.map((method) => [method.id, method]));

    for (const item of ngnItems) {
      const method = methodById.get(item.paymentMethodId ?? '');
      const ready = isVerifiedNgnDestination(item, method);
      result.set(item.id, {
        ready,
        message: ready
          ? undefined
          : 'A verified Nigerian bank account is required for Nomba payroll.',
        platformFeeAmount:
          calculatePayrollPlatformFee(String(item.paymentAmount), platformFeePercentage) ?? '0',
        platformFeePercentage,
      });
    }
    return result;
  }

  async processRun(
    run: PayrollRun,
    items: PayrollItem[],
    tenantId: string,
  ): Promise<PaymentResult[]> {
    if (
      !isNombaConfigured() ||
      process.env.NOMBA_PAYROLL_NGN_ENABLED !== 'true' ||
      !hasConfirmedNombaFeeConfiguration()
    ) {
      throw new ServiceUnavailableException(
        'Nomba NGN payroll payouts require enabled credentials and a confirmed, configured per-transfer fee.',
      );
    }
    const ids = [...new Set(items.map((item) => item.paymentMethodId).filter(Boolean))];
    const methods = ids.length
      ? await this.paymentMethods.find({
          where: { id: In(ids), tenantId },
          select: {
            id: true,
            memberId: true,
            currency: true,
            country: true,
            bankCode: true,
            accountNumber: true,
            accountName: true,
            status: true,
            type: true,
          },
        })
      : [];
    for (const method of methods) {
      this.payOne.decryptBankDetails(method);
    }
    const methodById = new Map(methods.map((method) => [method.id, method]));
    const notReady = items.find(
      (item) => !isVerifiedNgnDestination(item, methodById.get(item.paymentMethodId ?? '')),
    );
    if (notReady) {
      throw new BadRequestException(
        'A verified Nigerian bank account is required for Nomba payroll.',
      );
    }
    const results: PaymentResult[] = [];

    // Bounded batches avoid unbounded provider fan-out while allowing routine payroll runs to
    // progress faster. The payroll-run lock and conditional item claim protect concurrent callers.
    for (let offset = 0; offset < items.length; offset += NOMBA_BATCH_SIZE) {
      const batch = items.slice(offset, offset + NOMBA_BATCH_SIZE);
      results.push(
        ...(await Promise.all(
          batch.map((item) =>
            this.payOne.payOne(run, item, tenantId, methodById.get(item.paymentMethodId ?? '')),
          ),
        )),
      );
    }
    return results;
  }
}
