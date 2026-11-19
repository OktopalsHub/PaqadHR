import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuditContext } from 'src/common/interfaces/audit-context.interface';

import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { type FloatTopupMeta, readFloatTopupMeta } from '../utils/payroll-funding-meta.util';
import { providerDisplayName, toIsoDatePart } from '../utils/payroll-funding-run.util';
import { PayrollFloatTopupCheckoutService } from './payroll-float-topup-checkout.service';
import { PayrollFloatTopupCompletionService } from './payroll-float-topup-completion.service';
import type { PayrollFundPreflight } from './payroll-funding-preflight.service';
import { PayrollFundingPreflightService } from './payroll-funding-preflight.service';
import { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

export type { PayrollFundPreflight };

@Injectable()
export class PayrollFundingService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly paymentOrchestrator: PayrollPaymentOrchestrator,
    private readonly preflightService: PayrollFundingPreflightService,
    private readonly floatTopupCheckout: PayrollFloatTopupCheckoutService,
    private readonly floatTopupCompletion: PayrollFloatTopupCompletionService,
  ) {}

  /**
   * Hosted checkout providers use a one-time checkout for each payroll run. The verified
   * checkout webhook starts immediate payroll payouts; scheduled runs remain funded and wait
   * for the scheduled-payout processor. PaqadHR does not maintain a reusable company wallet.
   */
  async fundAndPay(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<
    | { action: 'paid'; result: unknown }
    | {
        action: 'checkout';
        checkoutUrl: string;
        orderReference: string;
        preflight: PayrollFundPreflight;
      }
  > {
    const preflight = await this.preflightService.preflight(payrollRunId, tenantId);

    if (preflight.canCheckout && preflight.requiredAmount > 0) {
      const feeParts = [
        preflight.platformFee != null && preflight.platformFee > 0
          ? `${preflight.platformFee} ${preflight.currency} PaqadHR fee`
          : null,
        preflight.payoutFeeReserve != null && preflight.payoutFeeReserve > 0
          ? `${preflight.payoutFeeReserve} ${preflight.currency} payout-fee reserve`
          : null,
        preflight.nombaTransferCharge != null && preflight.nombaTransferCharge > 0
          ? `${preflight.nombaTransferCharge} ${preflight.currency} PaqadHR Nomba transfer charge`
          : null,
      ].filter((part): part is string => part != null);
      const feeNote = feeParts.length > 0 ? ` (includes ${feeParts.join(' + ')})` : '';
      const checkoutPreflight: PayrollFundPreflight = {
        ...preflight,
        ok: false,
        shortfall: preflight.shortfall,
        message:
          preflight.balanceSupported &&
          preflight.availableBalance != null &&
          preflight.shortfall < preflight.requiredAmount
            ? `Your company pays ${preflight.shortfall} ${preflight.currency}${feeNote} in checkout. Your provider balance covers ${preflight.availableBalance} ${preflight.currency}. We then route each employee's salary via ${providerDisplayName(preflight.provider)}.`
            : `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} in checkout. We then route each employee's salary via ${providerDisplayName(preflight.provider)}.`,
      };
      const checkout = await this.floatTopupCheckout.createFloatTopupCheckout(
        payrollRunId,
        tenantId,
        auditContext.performedById,
        checkoutPreflight,
      );
      return {
        action: 'checkout',
        checkoutUrl: checkout.checkoutUrl,
        orderReference: checkout.orderReference,
        preflight: checkoutPreflight,
      };
    }

    if (preflight.ok) {
      const run = await this.preflightService.requireApprovedRun(payrollRunId, tenantId);
      const existing = readFloatTopupMeta(run);
      run.metadata = {
        ...run.metadata,
        floatTopup: {
          orderReference: existing.orderReference,
          status: 'completed',
          completedAt: new Date().toISOString(),
          shortfall: 0,
          provider: preflight.provider,
          fundingCurrency: preflight.currency,
          references: existing.references,
        } satisfies FloatTopupMeta,
      };
      await this.payrollRunRepository.save(run);
      const result = await this.paymentOrchestrator.payNowPayroll(
        payrollRunId,
        tenantId,
        auditContext,
      );
      return { action: 'paid', result };
    }

    throw new BadRequestException(preflight.message);
  }

  async fundScheduledPayroll(
    payrollRunId: string,
    tenantId: string,
    auditContext: AuditContext,
  ): Promise<
    | { action: 'scheduled'; run: PayrollRun }
    | {
        action: 'checkout';
        checkoutUrl: string;
        orderReference: string;
        preflight: PayrollFundPreflight;
      }
  > {
    const run = await this.preflightService.requireApprovedRun(payrollRunId, tenantId);
    if (run.payoutMode !== 'scheduled') {
      throw new BadRequestException('Payroll run is not configured for scheduled payout');
    }
    if (!run.paymentDate) {
      throw new BadRequestException('Set a payment date before scheduling');
    }

    const existingTopup = readFloatTopupMeta(run);
    if (existingTopup.status === 'completed') {
      return { action: 'scheduled', run };
    }
    if (existingTopup.status === 'pending' && existingTopup.orderReference) {
      throw new BadRequestException(
        'Payroll funding checkout is already pending. Complete the existing checkout before scheduling again.',
      );
    }

    const preflight = await this.preflightService.preflight(payrollRunId, tenantId);
    if (preflight.canCheckout && preflight.requiredAmount > 0) {
      const feeNote =
        preflight.platformFee != null && preflight.platformFee > 0
          ? ` (includes ${preflight.platformFee} ${preflight.currency} Paqad fee)`
          : '';
      const checkoutPreflight: PayrollFundPreflight = {
        ...preflight,
        ok: false,
        shortfall: preflight.shortfall,
        message:
          preflight.balanceSupported &&
          preflight.availableBalance != null &&
          preflight.shortfall < preflight.requiredAmount
            ? `Your company pays ${preflight.shortfall} ${preflight.currency}${feeNote} now. Your provider balance covers ${preflight.availableBalance} ${preflight.currency}. Employees are paid on ${toIsoDatePart(run.paymentDate)} via ${providerDisplayName(preflight.provider)}.`
            : `Your company pays ${preflight.requiredAmount} ${preflight.currency}${feeNote} now. Employees are paid on ${toIsoDatePart(run.paymentDate)} via ${providerDisplayName(preflight.provider)}.`,
      };
      const checkout = await this.floatTopupCheckout.createFloatTopupCheckout(
        payrollRunId,
        tenantId,
        auditContext.performedById,
        checkoutPreflight,
      );
      return {
        action: 'checkout',
        checkoutUrl: checkout.checkoutUrl,
        orderReference: checkout.orderReference,
        preflight: checkoutPreflight,
      };
    }

    if (!preflight.ok) {
      throw new BadRequestException(preflight.message);
    }

    const existing = readFloatTopupMeta(run);
    run.metadata = {
      ...run.metadata,
      floatTopup: {
        orderReference: existing.orderReference,
        status: 'completed',
        completedAt: new Date().toISOString(),
        shortfall: 0,
        provider: preflight.provider,
        fundingCurrency: preflight.currency,
        references: existing.references,
      } satisfies FloatTopupMeta,
    };
    const saved = await this.payrollRunRepository.save(run);
    return { action: 'scheduled', run: saved };
  }

  async assertFundedOrThrow(payrollRunId: string, tenantId: string): Promise<void> {
    const preflight = await this.preflightService.preflight(payrollRunId, tenantId);
    if (!preflight.ok) {
      throw new BadRequestException(preflight.message);
    }
  }

  preflight(...args: Parameters<PayrollFundingPreflightService['preflight']>) {
    return this.preflightService.preflight(...args);
  }

  completeFloatTopup(
    ...args: Parameters<PayrollFloatTopupCompletionService['completeFloatTopup']>
  ) {
    return this.floatTopupCompletion.completeFloatTopup(...args);
  }
}

export {
  FLOAT_TOPUP_CREATION_IN_FLIGHT_MS,
  FLOAT_TOPUP_PENDING_TTL_MS,
} from '../utils/payroll-funding.constants';
