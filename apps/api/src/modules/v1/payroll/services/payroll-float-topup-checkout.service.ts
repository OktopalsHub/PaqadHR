import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import { tenantFrontendUrl } from 'src/common/utils/tenant-frontend-url.util';
import { Repository } from 'typeorm';

import { resolveCheckoutCustomerFullName } from '../../rewards/utils/checkout-customer-name.util';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  buildPayrollFloatOrderRef,
  type PayrollFloatOrderRefProvider,
} from '../utils/payroll-float-order-ref.util';
import {
  type FloatTopupMeta,
  readFloatTopupMeta,
  withFloatTopupHistory,
} from '../utils/payroll-funding-meta.util';
import {
  FLOAT_TOPUP_CREATION_IN_FLIGHT_MS,
  FLOAT_TOPUP_PENDING_TTL_MS,
} from '../utils/payroll-funding.constants';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';
import type { PayrollFundPreflight } from './payroll-funding-preflight.service';
import { PayrollFundingPreflightService } from './payroll-funding-preflight.service';

@Injectable()
export class PayrollFloatTopupCheckoutService {
  constructor(
    private readonly balanceService: PayrollFloatBalanceService,
    private readonly paymentFactory: PaymentProviderFactoryService,
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly preflightService: PayrollFundingPreflightService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @Optional() private readonly attemptHistory?: PayrollAttemptHistoryService,
  ) {}

  async createFloatTopupCheckout(
    payrollRunId: string,
    tenantId: string,
    memberId: string,
    preflight: PayrollFundPreflight,
  ): Promise<{ checkoutUrl: string; orderReference: string }> {
    const provider = preflight.provider as PayrollFloatOrderRefProvider;
    if (!this.balanceService.supportsHostedFloatTopup(provider)) {
      throw new BadRequestException(preflight.message);
    }

    const adapter = this.paymentFactory.resolveCheckoutAdapter(provider);
    if (!adapter?.isConfigured()) {
      throw new BadRequestException(
        `Checkout is not configured for ${provider}. Fund via ${preflight.dashboardUrl || 'the provider dashboard'}.`,
      );
    }

    const customerEmail = await this.preflightService.resolveBillingEmail(tenantId);
    if (!customerEmail) {
      throw new BadRequestException(
        'Billing contact email is not configured. Add it in Settings → Billing.',
      );
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });
    const callbackUrl = tenant?.slug
      ? tenantFrontendUrl(tenant.slug, `/payroll?fund_pay=done&runId=${payrollRunId}`)
      : tenantFrontendUrl('', `/payroll?fund_pay=done&runId=${payrollRunId}`);

    const amount = preflight.shortfall;

    // Reserve the reference under a row lock before the provider call. A session the company ends
    // up paying must already be attributable to this run, and a second click must not replace the
    // reference that collection.succeeded is matched against.
    const reservation = await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');

      const latest = readFloatTopupMeta(locked);
      if (latest.status === 'pending' && latest.orderReference) {
        const requestedAt = Date.parse(latest.checkoutRequestedAt ?? '');
        const ageMs = Number.isFinite(requestedAt) ? Date.now() - requestedAt : Number.NaN;
        if (Number.isFinite(ageMs) && ageMs < FLOAT_TOPUP_PENDING_TTL_MS) {
          if (!latest.checkoutUrl) {
            if (ageMs < FLOAT_TOPUP_CREATION_IN_FLIGHT_MS) {
              throw new BadRequestException(
                'A funding checkout is still being created for this run. Check its status before retrying.',
              );
            }
          } else {
            return {
              action: 'resume' as const,
              checkoutUrl: latest.checkoutUrl,
              orderReference: latest.orderReference,
            };
          }
        }
      }

      const orderReference = buildPayrollFloatOrderRef(provider, tenantId);
      locked.metadata = {
        ...locked.metadata,
        floatTopup: {
          orderReference,
          status: 'pending',
          shortfall: amount,
          provider,
          fundingCurrency: preflight.currency,
          checkoutRequestedAt: new Date().toISOString(),
          references: withFloatTopupHistory(latest, orderReference),
        } satisfies FloatTopupMeta,
      };
      await manager.save(locked);
      await this.attemptHistory?.beginFundingAttempt(
        {
          tenantId,
          payrollRunId,
          purpose: 'run_funding',
          provider,
          orderReference,
          idempotencyKey: `payroll-funding:${tenantId}:${payrollRunId}:run_funding:${orderReference}`,
          currency: preflight.currency,
          amount: String(preflight.requiredAmount),
          checkoutAmount: String(amount),
          balanceApplied:
            preflight.availableBalance == null
              ? null
              : String(Math.max(0, preflight.requiredAmount - amount)),
          createdById: memberId,
          expiresAt: new Date(Date.now() + FLOAT_TOPUP_PENDING_TTL_MS),
          metadata: { checkoutStatus: 'pending' },
        },
        manager,
      );
      return { action: 'create' as const, orderReference };
    });

    if (reservation.action === 'resume') {
      return {
        checkoutUrl: reservation.checkoutUrl,
        orderReference: reservation.orderReference,
      };
    }

    const meta = {
      tenantId,
      payrollRunId,
      billingType: 'payroll_float_topup',
      expectedAmount: String(amount),
      initiatedByMemberId: memberId,
    };

    let result: Awaited<ReturnType<typeof adapter.createCheckout>>;
    try {
      result = await adapter.createCheckout({
        orderReference: reservation.orderReference,
        customerEmail,
        amount,
        currency: preflight.currency,
        callbackUrl,
        customerName: resolveCheckoutCustomerFullName(tenant?.name, customerEmail),
        savePaymentMethod: false,
        meta,
      });
    } catch (error) {
      await this.attemptHistory?.transitionFundingAttempt({
        tenantId,
        payrollRunId,
        provider,
        orderReference: reservation.orderReference,
        status: 'requires_review',
      });
      throw error;
    }
    await this.attemptHistory?.transitionFundingAttempt({
      tenantId,
      payrollRunId,
      provider,
      orderReference: reservation.orderReference,
      status: 'pending',
      providerReference: result.orderReference,
    });

    await this.payrollRunRepository.manager.transaction(async (manager) => {
      const locked = await manager.getRepository(PayrollRun).findOne({
        where: { id: payrollRunId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Payroll run not found');

      const latest = readFloatTopupMeta(locked);
      // A webhook can credit the reserved reference before this write lands; never roll a
      // completed funding back to pending, and never drop a reference the provider renamed.
      if (latest.status !== 'pending' || !latest.orderReference) return;

      locked.metadata = {
        ...locked.metadata,
        floatTopup: {
          ...latest,
          orderReference: result.orderReference,
          status: 'pending',
          checkoutUrl: result.checkoutLink,
          references: withFloatTopupHistory(latest, result.orderReference),
        } satisfies FloatTopupMeta,
      };
      await manager.save(locked);
    });

    return {
      checkoutUrl: result.checkoutLink,
      orderReference: result.orderReference,
    };
  }
}
