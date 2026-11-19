import { BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentProviderError } from 'src/common/providers/payment-provider.interface';
import { BridgeApiService } from 'src/common/services/bridge-api.service';
import { DataSource, Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import { CustodyWallet } from '../../wallets/entities/custody-wallet.entity';
import { ProviderExternalAccount } from '../../wallets/entities/provider-external-account.entity';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { BridgeApplyOps } from './bridge-apply.ops';
import { BridgeHelperOps } from './bridge-helper.ops';
import { ProcessItemBuilt, ProcessItemValidated } from './bridge-payroll-payout.shared';
import { BridgeTransferPrepOps } from './bridge-transfer-prep.ops';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';

export class BridgeTransferSubmitOps {
  constructor(
    private readonly bridgeApi: BridgeApiService,
    private readonly ledger: WalletLedgerService,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    private readonly payrollItems: PayrollItemRepository,
    private readonly dataSource: DataSource,
    private readonly attemptHistory: PayrollAttemptHistoryService,
    private readonly apply: BridgeApplyOps,
    private readonly helper: BridgeHelperOps,
    private readonly transferPrep: BridgeTransferPrepOps,
  ) {}

  async processItem(input: {
    run: PayrollRun;
    item: PayrollItem;
    tenantId: string;
    country: string;
    userId?: string;
    orgWallet?: CustodyWallet;
    employeeWallet?: CustodyWallet;
    orgCustomerId?: string | null;
    planFeePercentage: number;
    bankPayout?: {
      externalAccount: ProviderExternalAccount;
      employeeCustomerId?: string;
      sourceCurrency: 'USDC' | 'USDT';
      network: string;
      walletAmount?: string;
      planFeeAmount?: string;
      sourceAmount?: string;
      exchangeRate?: string;
      rateUpdatedAt?: string;
    };
  }): Promise<PaymentResult> {
    const validated = await this.transferPrep.validatePayoutInput(input);
    if ('success' in validated) return validated;
    const built = await this.transferPrep.buildTransferOperation(validated);
    const context = { ...validated, ...built };
    const reservationFailure = await this.reserveFunds(context);
    if (reservationFailure) return reservationFailure;
    return this.submitTransfer(context);
  }

  async reserveFunds(
    ctx: ProcessItemValidated & ProcessItemBuilt,
  ): Promise<PaymentResult | undefined> {
    const {
      item,
      run,
      tenantId,
      currency,
      isBankPayout,
      sourceCurrency,
      network,
      planFeeAmount,
      totalSourceAmount,
      attempt,
      idempotencyKey,
      operation,
      available,
      reserved,
    } = ctx;
    try {
      await this.dataSource.transaction(async (manager) => {
        const itemRepo = manager.getRepository(PayrollItem);
        const claimed = await itemRepo
          .createQueryBuilder()
          .update(PayrollItem)
          .set({
            status: PayrollItemStatus.PROCESSING,
            paymentProvider: 'Bridge',
            metadata: {
              ...(item.metadata ?? {}),
              bridgePayoutAttempt: attempt,
              bridgeWalletOperationId: operation.idempotencyKey,
            },
          })
          .where('id = :id AND status IN (:...statuses)', {
            id: item.id,
            statuses: [PayrollItemStatus.PENDING, PayrollItemStatus.FAILED],
          })
          .andWhere('payroll_run_id IN (SELECT id FROM payroll_runs WHERE tenant_id = :tenantId)', {
            tenantId,
          })
          .execute();
        if ((claimed.affected ?? 0) !== 1)
          throw new BadRequestException('Payroll item is no longer eligible for payout.');
        await this.ledger.reserveFundsInManager(manager, {
          availableAccountId: available.id,
          reservedAccountId: reserved.id,
          amount: totalSourceAmount,
          currency: sourceCurrency!,
          idempotencyKey: `${idempotencyKey}:reserve`,
          kind: 'payroll_reservation',
        });
        await manager.getRepository(WalletOperation).save(operation);
        await this.attemptHistory.beginPayoutAttempt(
          {
            tenantId,
            payrollRunId: run.id,
            payrollItemId: item.id,
            provider: 'bridge',
            attemptNumber: attempt,
            merchantReference: idempotencyKey,
            idempotencyKey,
            sourceAmount: totalSourceAmount,
            sourceCurrency: sourceCurrency!,
            destinationAmount: String(item.paymentAmount),
            destinationCurrency: currency!,
            initialStatus: 'processing',
            metadata: {
              payoutMode: isBankPayout ? 'bank' : 'wallet',
              network,
              planFeeAmount,
            },
          },
          manager,
        );
      });
    } catch (error) {
      return this.helper.failItem(
        item,
        tenantId,
        error instanceof Error ? error.message : 'Bridge payroll reservation failed.',
      );
    }

    return undefined;
  }

  async submitTransfer(ctx: ProcessItemValidated & ProcessItemBuilt): Promise<PaymentResult> {
    const {
      item,
      tenantId,
      isBankPayout,
      capability,
      planFeeAmount,
      totalSourceAmount,
      idempotencyKey,
      operation,
      orgWallet,
      employeeWallet,
      orgCustomerId,
    } = ctx;
    try {
      const response = await this.bridgeApi.createTransfer(
        {
          amount: totalSourceAmount,
          on_behalf_of: orgCustomerId,
          ...(planFeeAmount !== '0' ? { developer_fee: planFeeAmount } : {}),
          client_reference_id: idempotencyKey,
          source: {
            payment_rail: 'bridge_wallet',
            currency: capability.bridgeCurrency,
            bridge_wallet_id: orgWallet.providerWalletId,
          },
          destination: {
            payment_rail: capability.bridgePaymentRail,
            currency: capability.bridgeCurrency,
            bridge_wallet_id: employeeWallet.providerWalletId,
          },
        },
        idempotencyKey,
      );
      const bridgeReceipt = this.helper.readProviderReceipt(response.receipt);
      await this.operations
        .createQueryBuilder()
        .update(WalletOperation)
        .set({
          providerReference: response.id,
          status: 'processing',
          metadata: {
            ...(operation.metadata ?? {}),
            providerState: this.helper.readProviderState(response.state),
            ...(bridgeReceipt ? { bridgeReceipt } : {}),
          },
        })
        .where('idempotency_key = :idempotencyKey AND status = :status', {
          idempotencyKey,
          status: 'created',
        })
        .execute();
      const currentOperation = await this.operations.findOne({ where: { idempotencyKey } });
      if (this.helper.readProviderState(response.state) === 'payment_processed') {
        await this.apply.applyTransferState(
          response.id,
          'payment_processed',
          null,
          idempotencyKey,
          this.helper.readProviderReceipt(response.receipt),
        );
        return this.helper.paymentResultAfterTransfer(item, response.id, isBankPayout);
      }
      if (currentOperation?.status === 'completed') {
        return this.helper.paymentResultAfterTransfer(item, response.id, isBankPayout);
      }
      if (currentOperation?.status === 'failed') {
        return {
          success: false,
          outcome: 'failed',
          transactionId: response.id,
          reference: response.id,
          provider: 'Bridge',
          providerStatus: 'failed',
          rail: 'crypto',
        };
      }
      return {
        success: true,
        outcome: 'processing',
        transactionId: response.id,
        reference: response.id,
        provider: 'Bridge',
        providerStatus: currentOperation?.status ?? this.helper.readProviderState(response.state),
        rail: 'crypto',
      };
    } catch (error) {
      const ambiguous = error instanceof PaymentProviderError ? error.retryable : true;
      const update = await this.operations
        .createQueryBuilder()
        .update(WalletOperation)
        .set({ status: ambiguous ? 'requires_review' : 'failed' })
        .where('idempotency_key = :idempotencyKey AND status = :status', {
          idempotencyKey,
          status: 'created',
        })
        .execute();
      if (!ambiguous && (update.affected ?? 0) > 0) await this.helper.releaseReservation(operation);
      if (!ambiguous && (update.affected ?? 0) > 0) {
        await updatePayrollItemScopedIfStatus(
          this.payrollItems,
          item.id,
          tenantId,
          PayrollItemStatus.PROCESSING,
          {
            status: PayrollItemStatus.FAILED,
            failureReason: 'Bridge rejected the payroll transfer.',
          },
        );
      }
      const currentOperation = await this.operations.findOne({ where: { idempotencyKey } });
      if (currentOperation?.status === 'requires_review') {
        await this.helper.transitionPayoutAttemptForOperation(
          currentOperation,
          'requires_review',
          currentOperation.providerReference ?? undefined,
        );
      } else if (currentOperation?.status === 'failed') {
        await this.helper.transitionPayoutAttemptForOperation(
          currentOperation,
          'failed',
          currentOperation.providerReference ?? undefined,
        );
      }
      if (currentOperation?.status === 'completed') {
        return this.helper.paymentResultAfterTransfer(
          item,
          currentOperation.providerReference ?? '',
          isBankPayout,
        );
      }
      return {
        success: false,
        outcome: ambiguous ? 'processing' : 'failed',
        error: ambiguous
          ? 'Bridge transfer status is being reconciled; do not retry yet.'
          : 'Bridge rejected the payroll transfer.',
        errorCode: error instanceof PaymentProviderError ? error.code : undefined,
        retryable: ambiguous,
        provider: 'Bridge',
        rail: 'crypto',
      };
    }
  }
}
