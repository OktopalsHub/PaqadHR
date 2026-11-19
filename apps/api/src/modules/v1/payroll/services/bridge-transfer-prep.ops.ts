import { InjectRepository } from '@nestjs/typeorm';
import {
  assertBridgePayrollCapability,
  PayrollAsset,
} from 'src/common/config/bridge-payroll-capabilities.config';
import { Repository } from 'typeorm';

import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { BridgeHelperOps } from './bridge-helper.ops';
import { ProcessItemInput, ProcessItemValidated } from './bridge-payroll-payout.shared';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';

export class BridgeTransferPrepOps {
  constructor(
    private readonly ledger: WalletLedgerService,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    private readonly attemptHistory: PayrollAttemptHistoryService,
    private readonly helper: BridgeHelperOps,
  ) {}

  async validatePayoutInput(input: ProcessItemInput) {
    const { item, run, tenantId } = input;
    const currency = item.paymentCurrency?.toUpperCase();
    const isBankPayout = Boolean(input.bankPayout);
    const sourceCurrency = input.bankPayout?.sourceCurrency ?? currency;
    const network = input.bankPayout?.network ?? this.helper.readNetwork(item);
    const amount = this.helper.amountString(item);
    if (!isBankPayout && currency !== 'USDC' && currency !== 'USDT') {
      return this.helper.failItem(
        item,
        tenantId,
        `Bridge employee wallet payout for ${currency || 'this currency'} is not configured.`,
      );
    }
    let capability: ReturnType<typeof assertBridgePayrollCapability>;
    try {
      capability = assertBridgePayrollCapability({
        operation: 'wallet_transfer',
        sourceCurrency: sourceCurrency as PayrollAsset,
        currency: sourceCurrency as PayrollAsset,
        country: input.country,
        network,
      });
    } catch (error) {
      return this.helper.failItem(
        item,
        tenantId,
        error instanceof Error ? error.message : 'Bridge payout route is disabled.',
      );
    }
    if (!input.userId || !input.orgWallet || !input.employeeWallet || !input.orgCustomerId) {
      return this.helper.failItem(
        item,
        tenantId,
        'Complete Bridge organization and employee wallet setup before payroll payout.',
      );
    }
    if (input.orgWallet.network !== input.employeeWallet.network) {
      return this.helper.failItem(
        item,
        tenantId,
        'Organization and employee Bridge wallets must use the same network.',
      );
    }
    if (!amount || Number(amount) <= 0)
      return this.helper.failItem(item, tenantId, 'Payroll payout amount is invalid.');
    const planFeeAmount = isBankPayout
      ? input.bankPayout?.planFeeAmount
      : this.helper.calculatePlanFee(amount, input.planFeePercentage);
    const walletAmount = isBankPayout ? input.bankPayout?.walletAmount : amount;
    const sourceAmount = isBankPayout ? input.bankPayout?.sourceAmount : null;
    if (!planFeeAmount || !walletAmount || (isBankPayout && !sourceAmount)) {
      return this.helper.failItem(
        item,
        tenantId,
        'The plan payroll fee could not be calculated safely.',
      );
    }
    const totalSourceAmount = sourceAmount ?? this.helper.addAmounts(walletAmount, planFeeAmount);
    let withdrawalCapability: ReturnType<typeof assertBridgePayrollCapability> | null = null;
    if (isBankPayout && input.bankPayout) {
      try {
        withdrawalCapability = assertBridgePayrollCapability({
          operation: 'withdrawal',
          sourceCurrency: input.bankPayout.sourceCurrency,
          currency: currency as 'USD' | 'EUR' | 'GBP',
          country: input.bankPayout.externalAccount.country,
          network,
        });
      } catch (error) {
        return this.helper.failItem(
          item,
          tenantId,
          error instanceof Error ? error.message : 'Bridge bank payout route is disabled.',
        );
      }
      if (
        input.bankPayout.externalAccount.userId !== input.userId ||
        input.bankPayout.externalAccount.memberId !== item.memberId ||
        input.bankPayout.externalAccount.currency !== currency ||
        !input.bankPayout.employeeCustomerId ||
        !withdrawalCapability.bridgeCurrency ||
        !withdrawalCapability.bridgePaymentRail
      ) {
        return this.helper.failItem(
          item,
          tenantId,
          'Employee Bridge bank destination is not ready.',
        );
      }
    }

    return {
      input,
      userId: input.userId,
      orgWallet: input.orgWallet,
      employeeWallet: input.employeeWallet,
      orgCustomerId: input.orgCustomerId,
      item,
      run,
      tenantId,
      currency,
      isBankPayout,
      sourceCurrency,
      network,
      amount,
      capability,
      withdrawalCapability,
      planFeeAmount,
      walletAmount,
      totalSourceAmount,
    };
  }

  async buildTransferOperation(ctx: ProcessItemValidated) {
    const {
      input,
      item,
      run,
      tenantId,
      currency,
      isBankPayout,
      sourceCurrency,
      network,
      amount,
      capability,
      withdrawalCapability,
      planFeeAmount,
      walletAmount,
      totalSourceAmount,
      orgWallet,
      employeeWallet,
      userId,
    } = ctx;
    const attempt = await this.attemptHistory.nextPayoutAttemptNumber({
      tenantId,
      payrollItemId: item.id,
      provider: 'bridge',
    });
    const idempotencyKey = `payroll:${run.id}:${item.id}:bridge:${attempt}`;
    const operation = this.operations.create({
      tenantId,
      payrollRunId: run.id,
      payrollItemId: item.id,
      sourceWalletId: orgWallet.id,
      destinationWalletId: employeeWallet.id,
      provider: 'bridge',
      kind: 'transfer',
      status: 'created',
      sourceAmount: totalSourceAmount,
      sourceCurrency: sourceCurrency!,
      destinationAmount: walletAmount,
      destinationCurrency: sourceCurrency!,
      network,
      exchangeRate: input.bankPayout?.exchangeRate ?? '1',
      providerReference: null,
      idempotencyKey,
      metadata: {
        sourceReservedAccountId: null,
        destinationAvailableAccountId: null,
        reservationKey: `${idempotencyKey}:reserve`,
        planFeeAmount,
        planFeePercentage: input.planFeePercentage,
      },
    });
    const available = await this.ledger.ensureAccount({
      ownerType: 'organization',
      tenantId,
      accountType: 'available',
      currency: sourceCurrency!,
      network,
    });
    const reserved = await this.ledger.ensureAccount({
      ownerType: 'organization',
      tenantId,
      accountType: 'reserved',
      currency: sourceCurrency!,
      network,
    });
    const employeeAvailable = await this.ledger.ensureAccount({
      ownerType: 'employee',
      userId: userId,
      accountType: 'available',
      currency: sourceCurrency!,
      network,
    });
    const platformFeeReceivable = await this.ledger.ensureAccount({
      ownerType: 'system',
      accountType: 'fee',
      currency: sourceCurrency!,
      network,
      normalSide: 'credit',
    });
    operation.metadata = {
      sourceAvailableAccountId: available.id,
      sourceReservedAccountId: reserved.id,
      destinationAvailableAccountId: employeeAvailable.id,
      platformFeeReceivableAccountId: platformFeeReceivable.id,
      planFeeAmount,
      planFeePercentage: input.planFeePercentage,
      ...(isBankPayout && input.bankPayout && withdrawalCapability
        ? {
            payoutMode: 'bank',
            employeeUserId: userId,
            employeeMemberId: item.memberId,
            employeeCustomerRecordId: input.bankPayout.externalAccount.providerCustomerId,
            employeePaymentMethodId: input.bankPayout.externalAccount.paymentMethodId,
            fiatDestinationAmount: amount,
            fiatDestinationCurrency: currency,
            providerExternalAccountId: input.bankPayout.externalAccount.providerExternalAccountId,
            employeeBridgeCustomerId: input.bankPayout.employeeCustomerId,
            withdrawalBridgeCurrency: withdrawalCapability.bridgeCurrency,
            withdrawalPaymentRail: withdrawalCapability.bridgePaymentRail,
            fxQuoteUpdatedAt: input.bankPayout.rateUpdatedAt,
            estimatedProviderFxBufferPercent: 1,
          }
        : {}),
      reservationKey: `${idempotencyKey}:reserve`,
      bridgeCurrency: capability.bridgeCurrency,
      bridgePaymentRail: capability.bridgePaymentRail,
    };
    return { attempt, idempotencyKey, operation, available, reserved };
  }
}
