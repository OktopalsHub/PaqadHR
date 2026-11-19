import { BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { WalletOperation } from '../../wallets/entities/wallet-operation.entity';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { PayrollItem } from '../entities/payroll-item.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { BridgeHelperOps } from './bridge-helper.ops';
import { FAILED_TRANSFER_STATES } from './bridge-payroll-payout.shared';
import { BridgeWithdrawalPrepOps } from './bridge-withdrawal-prep.ops';
import { BridgeWithdrawalSubmitOps } from './bridge-withdrawal-submit.ops';
import { PayrollPayoutService } from './payroll-payout.service';

export class BridgeApplyOps {
  constructor(
    private readonly ledger: WalletLedgerService,
    private readonly payrollPayouts: PayrollPayoutService,
    @InjectRepository(WalletOperation)
    private readonly operations: Repository<WalletOperation>,
    private readonly payrollItems: PayrollItemRepository,
    private readonly dataSource: DataSource,
    private readonly helper: BridgeHelperOps,
    private readonly withdrawalPrep: BridgeWithdrawalPrepOps,
    private readonly withdrawalSubmit: BridgeWithdrawalSubmitOps,
  ) {}

  async applyTransferState(
    transferId: string,
    state: string,
    eventId: string | null,
    idempotencyKey?: string | null,
    bridgeReceipt?: Record<string, string> | null,
  ): Promise<void> {
    const operation = await this.operations.findOne({
      where: [
        { provider: 'bridge', providerReference: transferId },
        ...(idempotencyKey ? [{ provider: 'bridge', idempotencyKey }] : []),
      ],
    });
    if (!operation?.payrollItemId) return;
    if (state === 'payment_processed') {
      await this.dataSource.transaction(async (manager) => {
        const latest = await manager
          .getRepository(WalletOperation)
          .findOne({ where: { id: operation.id } });
        if (!latest || latest.status === 'completed') return;
        const sourceReservedId = latest.metadata?.sourceReservedAccountId;
        if (typeof sourceReservedId !== 'string') {
          throw new BadRequestException(
            'Bridge payroll operation is missing ledger account references.',
          );
        }
        if (latest.kind === 'withdrawal') {
          const settlementAccountId = latest.metadata?.settlementAccountId;
          if (typeof settlementAccountId !== 'string' || !latest.payrollItemId) {
            throw new BadRequestException('Bridge withdrawal settlement account is missing.');
          }
          await this.ledger.postInManager(manager, {
            kind: 'employee_bank_withdrawal',
            idempotencyKey: `${latest.idempotencyKey}:settle`,
            provider: 'bridge',
            providerReference: transferId,
            evidence: { bridgeEventId: eventId },
            entries: [
              {
                accountId: sourceReservedId,
                direction: 'debit',
                amount: latest.sourceAmount,
                currency: latest.sourceCurrency,
              },
              {
                accountId: settlementAccountId,
                direction: 'credit',
                amount: latest.sourceAmount,
                currency: latest.sourceCurrency,
              },
            ],
          });
          latest.status = 'completed';
          latest.metadata = {
            ...(latest.metadata ?? {}),
            settledAt: new Date().toISOString(),
            bridgeEventId: eventId,
            ...(bridgeReceipt ? { bridgeReceipt } : {}),
          };
          await manager.getRepository(WalletOperation).save(latest);
          await manager.getRepository(PayrollItem).update(latest.payrollItemId, {
            status: PayrollItemStatus.PAID,
            transactionId: transferId,
            paymentProvider: 'Bridge',
            paidAt: new Date(),
            failureReason: null,
          });
          return;
        }
        const destinationAvailableId = latest.metadata?.destinationAvailableAccountId;
        if (typeof destinationAvailableId !== 'string') {
          throw new BadRequestException(
            'Bridge payroll operation is missing the employee wallet account.',
          );
        }
        const planFeeAmount =
          typeof latest.metadata?.planFeeAmount === 'string' ? latest.metadata.planFeeAmount : '0';
        const entries = [
          {
            accountId: sourceReservedId,
            direction: 'debit' as const,
            amount: latest.sourceAmount,
            currency: latest.sourceCurrency,
          },
          {
            accountId: destinationAvailableId,
            direction: 'credit' as const,
            amount: latest.destinationAmount ?? latest.sourceAmount,
            currency: latest.destinationCurrency ?? latest.sourceCurrency,
          },
        ];
        if (planFeeAmount !== '0') {
          const feeReceivableId = latest.metadata?.platformFeeReceivableAccountId;
          if (typeof feeReceivableId !== 'string') {
            throw new BadRequestException('Bridge payroll fee ledger accounts are missing.');
          }
          entries.push({
            accountId: feeReceivableId,
            direction: 'credit',
            amount: planFeeAmount,
            currency: latest.sourceCurrency,
          });
        }
        await this.ledger.postInManager(manager, {
          kind: 'payroll_wallet_transfer',
          idempotencyKey: `${latest.idempotencyKey}:settle`,
          provider: 'bridge',
          providerReference: transferId,
          evidence: { bridgeEventId: eventId },
          entries,
        });
        latest.status = 'completed';
        latest.metadata = {
          ...(latest.metadata ?? {}),
          settledAt: new Date().toISOString(),
          bridgeEventId: eventId,
          ...(bridgeReceipt ? { bridgeReceipt } : {}),
        };
        await manager.getRepository(WalletOperation).save(latest);
        if (latest.metadata?.payoutMode !== 'bank') {
          await manager.getRepository(PayrollItem).update(latest.payrollItemId!, {
            status: PayrollItemStatus.PAID,
            transactionId: transferId,
            paymentProvider: 'Bridge',
            paidAt: new Date(),
            failureReason: null,
          });
        }
      });
      await this.helper.transitionPayoutAttemptForOperation(
        operation,
        operation.kind === 'withdrawal' || operation.metadata?.payoutMode !== 'bank'
          ? 'payment_processed'
          : 'processing',
        transferId,
      );
      if (operation.kind === 'transfer' && operation.metadata?.payoutMode === 'bank') {
        const parent = await this.operations.findOne({ where: { id: operation.id } });
        if (parent) await this.startBankWithdrawal(parent);
      }
      await this.payrollPayouts.reconcilePayrollRunStatus(
        operation.payrollRunId!,
        operation.tenantId,
      );
      return;
    }
    if (state === 'underfunded' && operation.kind === 'withdrawal') {
      operation.status = 'requires_review';
      operation.metadata = {
        ...(operation.metadata ?? {}),
        providerState: state,
        bridgeEventId: eventId,
        reviewReason: 'Bridge fixed-output payout needs additional funds.',
      };
      await this.operations.save(operation);
      await this.helper.markBankPayoutForReview(
        operation,
        'Bridge FX rate moved beyond the funded buffer; bank payout requires reconciliation.',
      );
      return;
    }
    if (FAILED_TRANSFER_STATES.has(state) && operation.status !== 'completed') {
      operation.status = 'failed';
      operation.metadata = {
        ...(operation.metadata ?? {}),
        providerState: state,
        bridgeEventId: eventId,
      };
      await this.operations.save(operation);
      await this.helper.releaseReservation(operation);
      await updatePayrollItemScopedIfStatus(
        this.payrollItems,
        operation.payrollItemId,
        operation.tenantId,
        PayrollItemStatus.PROCESSING,
        { status: PayrollItemStatus.FAILED, failureReason: `Bridge transfer ${state}.` },
      );
      await this.helper.transitionPayoutAttemptForOperation(operation, 'failed', transferId);
    }
  }

  async startBankWithdrawal(parent: WalletOperation, allowRetry = false): Promise<void> {
    const meta = await this.withdrawalPrep.readWithdrawalMetadata(parent);
    if (!meta) return;
    const slot = await this.withdrawalPrep.selectWithdrawalAttempt(
      parent,
      allowRetry,
      meta.payrollItemId,
    );
    if (!slot) return;
    const parties = await this.withdrawalPrep.loadWithdrawalParties(parent, meta);
    if (!parties) return;
    const context = { parent, ...meta, ...slot, ...parties };
    const reserved = await this.withdrawalSubmit.reserveWithdrawal(context);
    if (!reserved) return;
    await this.withdrawalSubmit.submitWithdrawal(
      { ...context, ...reserved },
      (transferId, state, receipt) =>
        this.applyTransferState(transferId, state, null, slot.idempotencyKey, receipt),
    );
  }
}
