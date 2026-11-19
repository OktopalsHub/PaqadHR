import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { calculatePayrollPayoutFeeReserve } from 'src/common/config/payroll-payout-fee.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { Repository } from 'typeorm';

import { isNombaConfigured } from '../../../../common/config/nomba.config';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { isPayrollGatewayEnabled } from '../config/payroll-disbursement.config';
import { PayrollRun } from '../entities/payroll-run.entity';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import {
  countPayableTransfers,
  hasConfirmedNombaFeeConfiguration,
  payableNet,
  providerDisplayName,
} from '../utils/payroll-funding-run.util';
import { hasActivePayrollProcessingLock } from '../utils/payroll-processing-lock.util';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import { PayrollFeeService } from './payroll-fee.service';
import { PayrollFloatBalanceService } from './payroll-float-balance.service';

export type { PayrollFundPreflight } from '../utils/payroll-funding.types';

import type { PayrollFundPreflight } from '../utils/payroll-funding.types';

@Injectable()
@Injectable()
export class PayrollFundingPreflightService {
  constructor(
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly balanceService: PayrollFloatBalanceService,
    private readonly payrollFeeService: PayrollFeeService,
    private readonly bridgePayrollPayout: BridgePayrollPayoutService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantSettingsService: TenantSettingsService,
  ) {}

  async preflight(
    payrollRunId: string,
    tenantId: string,
    allowProcessingRun = false,
    retryItemIds?: string[],
  ): Promise<PayrollFundPreflight> {
    if (!isPayrollGatewayEnabled()) {
      throw new BadRequestException(
        'Payroll gateway is not configured. Configure Bridge wallet access or the enabled Nomba NGN route.',
      );
    }

    let run: PayrollRun;
    if (allowProcessingRun) {
      const retryableRun = await this.payrollRunRepository.findOne({
        where: { id: payrollRunId, tenantId },
        relations: { items: true },
      });
      if (!retryableRun) throw new NotFoundException('Payroll run not found');
      if (
        retryableRun.status !== PayrollStatus.APPROVED &&
        retryableRun.status !== PayrollStatus.PROCESSING
      ) {
        throw new BadRequestException(
          `Payroll run must be approved or processing before retry funding checks. Current: ${retryableRun.status}`,
        );
      }
      run = retryableRun;
      run.items = (run.items ?? []).filter(
        (item) =>
          item.status === PayrollItemStatus.FAILED &&
          (!retryItemIds || retryItemIds.includes(item.id)),
      );
    } else {
      run = await this.requireApprovedRun(payrollRunId, tenantId);
    }
    if (
      !allowProcessingRun &&
      run.baseCurrency.toUpperCase() === 'NGN' &&
      run.items.some((item) => item.status === PayrollItemStatus.FAILED)
    ) {
      throw new BadRequestException(
        'This NGN payroll run already has failed payouts. Use Retry failed payments so successful employee payouts are not funded or submitted again.',
      );
    }

    const currency = run.baseCurrency.toUpperCase();
    const payableItems = (run.items ?? []).filter(
      (item) =>
        item.status !== PayrollItemStatus.CANCELLED && item.metadata?.excludedFromRun !== true,
    );
    const allNgn =
      payableItems.length > 0 &&
      payableItems.every((item) => item.paymentCurrency?.toUpperCase() === 'NGN');
    if (
      currency === 'NGN' &&
      (!allNgn ||
        process.env.NOMBA_PAYROLL_NGN_ENABLED !== 'true' ||
        !isNombaConfigured() ||
        !hasConfirmedNombaFeeConfiguration())
    ) {
      throw new BadRequestException(
        'NGN payroll requires an NGN-only run, enabled Nomba credentials, and a confirmed Nomba fee in PAYROLL_PAYOUT_FEE_NOMBA_NGN.',
      );
    }
    const provider = currency === 'NGN' ? PaymentProvider.NOMBA : PaymentProvider.BRIDGE;
    const employeeTotal = payableNet(run);
    const feePercentage = await this.payrollFeeService.getPayrollFeePercentage(tenantId);
    const platformFee = Math.round(employeeTotal * (feePercentage / 100) * 100) / 100;
    const payoutTransferCount = countPayableTransfers(run, currency);
    const payoutFee = calculatePayrollPayoutFeeReserve({
      currency,
      provider,
      transferCount: payoutTransferCount,
    });
    const payoutFeeReserve = payoutFee.total;
    const nombaTransferCharge =
      provider === PaymentProvider.NOMBA && currency === 'NGN'
        ? Math.round(
            Number(process.env.PAYROLL_NOMBA_TRANSFER_CHARGE_NGN ?? '50') *
              payoutTransferCount *
              100,
          ) / 100
        : 0;
    if (!Number.isFinite(nombaTransferCharge) || nombaTransferCharge < 0) {
      throw new BadRequestException('Nomba transfer charge configuration is invalid.');
    }
    const requiredAmount =
      Math.round((employeeTotal + platformFee + payoutFeeReserve + nombaTransferCharge) * 100) /
      100;
    const dashboardUrl = this.balanceService.providerDashboardUrl(provider);
    const canCheckout = this.balanceService.supportsHostedFloatTopup(provider);
    const providerLabel = providerDisplayName(provider);

    if (requiredAmount <= 0) {
      return {
        ok: true,
        provider,
        currency,
        requiredAmount: 0,
        availableBalance: null,
        shortfall: 0,
        balanceSupported: false,
        canCheckout: false,
        dashboardUrl,
        message: 'No payable amount on this run.',
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
        nombaTransferCharge,
      };
    }

    // Nomba's settlement balance is shared at the provider-account level. Never let one
    // organization's existing balance silently fund another organization's payroll run.
    // Every NGN run receives its own checkout and run-scoped verified funding ledger event.
    if (provider === PaymentProvider.NOMBA && currency === 'NGN') {
      return {
        ok: false,
        provider,
        currency,
        requiredAmount,
        availableBalance: null,
        shortfall: requiredAmount,
        balanceSupported: false,
        canCheckout,
        dashboardUrl,
        message: `Your company pays ${requiredAmount} NGN in a separate Nomba checkout (${employeeTotal} employee pay + ${platformFee} PaqadHR plan fee + ${payoutFeeReserve} Nomba fee reserve + ${nombaTransferCharge} PaqadHR transfer charge). Payout starts only after Nomba confirms the checkout.`,
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
        nombaTransferCharge,
      };
    }

    if (provider === PaymentProvider.BRIDGE) {
      const requirement = await this.bridgePayrollPayout.assessFundingRequirement(run, tenantId);
      const available = requirement.available && requirement.requirements.length > 0;
      return {
        ok: available,
        provider,
        currency,
        requiredAmount,
        availableBalance: null,
        // Shortfalls can span different assets and networks; use the detailed array below instead
        // of summing unlike currencies into a misleading scalar amount.
        shortfall: 0,
        balanceSupported: requirement.requirements.length > 0,
        canCheckout: false,
        dashboardUrl,
        message:
          requirement.message ??
          (available
            ? 'Organization Bridge wallet balances cover this payroll run, including the FX buffer and PaqadHR plan fee. The FX rate is indicative and is not locked.'
            : 'Fund the organization Bridge wallet with the required source assets before processing payroll. FX requirements are indicative and are not locked quotes.'),
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
        nombaTransferCharge,
        bridgeFundingRequirements: requirement.requirements,
      };
    }

    const balance = await this.balanceService.getAvailableBalance(provider, currency);
    if (balance.supported) {
      const shortfall = Math.max(0, Math.round((requiredAmount - balance.available) * 100) / 100);
      if (shortfall <= 0) {
        return {
          ok: true,
          provider,
          currency,
          requiredAmount,
          availableBalance: balance.available,
          shortfall: 0,
          balanceSupported: true,
          canCheckout,
          dashboardUrl,
          message: `${providerLabel} balance already covers this payroll run, including the PaqadHR fee and payout-fee reserve.`,
          employeeTotal,
          platformFee,
          feePercentage,
          payoutFeeReserve,
          payoutFeePerTransfer: payoutFee.feePerTransfer,
          payoutTransferCount,
          nombaTransferCharge,
        };
      }
      return {
        ok: false,
        provider,
        currency,
        requiredAmount,
        availableBalance: balance.available,
        shortfall,
        balanceSupported: true,
        canCheckout,
        dashboardUrl,
        message: canCheckout
          ? `Your company needs to fund ${shortfall} ${currency} via checkout, including the PaqadHR fee and payout-fee reserve. We then pay employees automatically via ${providerLabel}.`
          : `Your company needs to fund ${shortfall} ${currency} in the ${providerLabel} dashboard, including fees, then retry.`,
        employeeTotal,
        platformFee,
        feePercentage,
        payoutFeeReserve,
        payoutFeePerTransfer: payoutFee.feePerTransfer,
        payoutTransferCount,
        nombaTransferCharge,
      };
    }

    // Balance unknown: treat full net as the funding target when checkout exists.
    return {
      ok: false,
      provider,
      currency,
      requiredAmount,
      availableBalance: null,
      shortfall: requiredAmount,
      balanceSupported: false,
      canCheckout,
      dashboardUrl,
      message: canCheckout
        ? `Could not read provider balance. Checkout will fund ${requiredAmount} ${currency}, including the PaqadHR fee and payout-fee reserve, then payout starts automatically.`
        : `${balance.reason} Open ${dashboardUrl || 'the provider dashboard'}, fund at least ${requiredAmount} ${currency}, including fees, then retry.`,
      employeeTotal,
      platformFee,
      feePercentage,
      payoutFeeReserve,
      payoutFeePerTransfer: payoutFee.feePerTransfer,
      payoutTransferCount,
      nombaTransferCharge,
    };
  }

  async requireApprovedRun(payrollRunId: string, tenantId: string): Promise<PayrollRun> {
    const run = await this.payrollRunRepository.findOne({
      where: { id: payrollRunId, tenantId },
      relations: { items: true },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (hasActivePayrollProcessingLock(run.processingLockedAt)) {
      throw new BadRequestException(
        'Payroll run is currently being processed. Wait before funding a retry.',
      );
    }
    if (run.status !== PayrollStatus.APPROVED) {
      throw new BadRequestException(`Must be APPROVED. Current: ${run.status}`);
    }
    return run;
  }

  async resolveBillingEmail(tenantId: string): Promise<string | null> {
    try {
      const settings = await this.tenantSettingsService.getTenantSettings(tenantId);
      const contactEmail = settings.settings.billing?.contactEmail?.trim();
      if (contactEmail) return contactEmail;
    } catch {
      // fall through
    }
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
      relations: { createdBy: true },
    });
    return tenant?.createdBy?.email?.trim() ?? null;
  }
}
