import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProviderError } from 'src/common/providers/payment-provider.interface';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { DataSource, Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { BridgeHelperOps } from './bridge-helper.ops';
import {
  FAILED_TRANSFER_STATES,
  WithdrawalContext,
  WithdrawalReserved,
} from './bridge-payroll-payout.shared';

export class BridgeWithdrawalSubmitOps {
  constructor(
    private readonly bridgeApi: BridgeApiService,
    private readonly ledger: WalletLedgerService,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    private readonly payrollItems: PayrollItemRepository,
    private readonly dataSource: DataSource,
    private readonly helper: BridgeHelperOps,
  ) {}

  async reserveWithdrawal(ctx: WithdrawalContext) {
    const {
      parent,
      userId,
      sourceCurrency,
      destinationAmount,
      destinationCurrency,
      attempt,
      idempotencyKey,
      externalAccount,
      employeeWallet,
      customerId,
      bridgeCurrency,
      bridgePaymentRail,
    } = ctx;
    const sourceReserved = await this.ledger.ensureAccount({
      ownerType: 'employee',
      userId,
      accountType: 'reserved',
      currency: sourceCurrency,
      network: employeeWallet.network,
    });
    const sourceAvailable = await this.ledger.ensureAccount({
      ownerType: 'employee',
      userId,
      accountType: 'available',
      currency: sourceCurrency,
      network: employeeWallet.network,
    });
    const settlementAccount = await this.ledger.ensureAccount({
      ownerType: 'system',
      accountType: 'clearing',
      currency: sourceCurrency,
      network: employeeWallet.network,
      normalSide: 'credit',
    });
    const operation = this.operations.create({
      tenantId: parent.tenantId,
      payrollRunId: parent.payrollRunId,
      payrollItemId: parent.payrollItemId,
      sourceWalletId: employeeWallet.id,
      destinationWalletId: null,
      provider: 'bridge',
      kind: 'withdrawal',
      status: 'created',
      sourceAmount: parent.destinationAmount!,
      sourceCurrency,
      destinationAmount,
      destinationCurrency,
      network: employeeWallet.network,
      exchangeRate: parent.exchangeRate,
      providerReference: null,
      idempotencyKey,
      metadata: {
        parentOperationId: parent.id,
        withdrawalAttempt: attempt,
        sourceAvailableAccountId: sourceAvailable.id,
        sourceReservedAccountId: sourceReserved.id,
        settlementAccountId: settlementAccount.id,
        employeeUserId: userId,
        providerExternalAccountId: externalAccount.providerExternalAccountId,
        employeeBridgeCustomerId: customerId,
        bridgeCurrency: bridgeCurrency,
        bridgePaymentRail: bridgePaymentRail,
        requestedDestinationAmount: destinationAmount,
      },
    });
    try {
      await this.dataSource.transaction(async (manager) => {
        await this.ledger.reserveFundsInManager(manager, {
          availableAccountId: sourceAvailable.id,
          reservedAccountId: sourceReserved.id,
          amount: operation.sourceAmount,
          currency: sourceCurrency,
          idempotencyKey: `${idempotencyKey}:reserve`,
          kind: 'employee_bank_withdrawal_reservation',
        });
        await manager.getRepository(WalletOperation).save(operation);
      });
    } catch (error) {
      await this.helper.markBankPayoutForReview(
        parent,
        error instanceof Error
          ? error.message
          : 'Employee wallet could not reserve the bank payout.',
      );
      return undefined;
    }

    return { operation };
  }

  async submitWithdrawal(
    ctx: WithdrawalContext & WithdrawalReserved,
    applyState: (
      transferId: string,
      state: ReturnType<BridgeHelperOps['readProviderState']>,
      receipt: ReturnType<BridgeHelperOps['readProviderReceipt']>,
    ) => Promise<void>,
  ): Promise<void> {
    const {
      parent,
      destinationAmount,
      destinationCurrency,
      idempotencyKey,
      externalAccount,
      employeeWallet,
      customerId,
      bridgeCurrency,
      bridgePaymentRail,
      operation,
    } = ctx;
    try {
      const response = await this.bridgeApi.createTransfer(
        {
          on_behalf_of: customerId,
          client_reference_id: idempotencyKey,
          source: {
            payment_rail: 'bridge_wallet',
            currency: bridgeCurrency,
            bridge_wallet_id: employeeWallet.providerWalletId,
            amount: operation.sourceAmount,
          },
          destination: {
            payment_rail: bridgePaymentRail,
            currency: destinationCurrency.toLowerCase(),
            external_account_id: externalAccount.providerExternalAccountId,
            amount: destinationAmount,
          },
        },
        idempotencyKey,
      );
      const receipt = this.helper.readProviderReceipt(response.receipt);
      await this.operations.update(
        { id: operation.id },
        {
          providerReference: response.id,
          status: 'processing',
          metadata: {
            ...(operation.metadata ?? {}),
            providerState: this.helper.readProviderState(response.state),
            ...(receipt ? { bridgeReceipt: receipt } : {}),
          },
        },
      );
      const state = this.helper.readProviderState(response.state);
      if (
        state === 'payment_processed' ||
        FAILED_TRANSFER_STATES.has(state) ||
        state === 'underfunded'
      ) {
        await applyState(response.id, state, receipt);
      }
    } catch (error) {
      const ambiguous = error instanceof PaymentProviderError ? error.retryable : true;
      await this.operations.update(
        { id: operation.id },
        {
          status: ambiguous ? 'requires_review' : 'failed',
          metadata: {
            ...(operation.metadata ?? {}),
            errorCode: error instanceof PaymentProviderError ? error.code : 'UNKNOWN',
          },
        },
      );
      if (ambiguous) {
        await this.helper.markBankPayoutForReview(
          parent,
          'Bridge bank transfer status is being reconciled.',
        );
      } else {
        await this.helper.releaseReservation(operation);
        await updatePayrollItemScopedIfStatus(
          this.payrollItems,
          parent.payrollItemId!,
          parent.tenantId,
          PayrollItemStatus.PROCESSING,
          { status: PayrollItemStatus.FAILED, failureReason: 'Bridge bank payout was rejected.' },
        );
        await this.helper.transitionPayoutAttemptForOperation(parent, 'failed');
      }
    }
  }
}
