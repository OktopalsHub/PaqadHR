import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PaymentResult } from 'src/common/interfaces/payment-result.interface';
import { EncryptionService } from 'src/common/services/encryption.service';
import { NombaTransfersService } from 'src/common/services/nomba-transfers.service';

import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollRun } from '../entities/payroll-run.entity';
import { updatePayrollItemScopedIfStatus } from '../repositories/payroll-item-write.util';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { buildPayrollMerchantRef } from '../utils/payroll-merchant-ref.util';
import { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollPayoutService } from './payroll-payout.service';

export class NombaPayOneOps {
  constructor(
    private readonly transfers: NombaTransfersService,
    private readonly payrollPayouts: PayrollPayoutService,
    private readonly payrollItems: PayrollItemRepository,
    private readonly encryption: EncryptionService,
    private readonly attemptHistory: PayrollAttemptHistoryService,
  ) {}

  async payOne(
    run: PayrollRun,
    item: PayrollItem,
    tenantId: string,
    method?: PaymentMethod,
  ): Promise<PaymentResult> {
    if (!method?.bankCode || !method.accountNumber || !method.accountName) {
      return {
        success: false,
        outcome: 'failed',
        error: 'Verified Nomba bank details are missing.',
        provider: 'Nomba',
        rail: 'bank',
      };
    }

    const attempt = await this.attemptHistory.nextPayoutAttemptNumber({
      tenantId,
      payrollItemId: item.id,
      provider: 'nomba',
    });
    const merchantTxRef = buildPayrollMerchantRef(run.id, item.id, attempt - 1);
    const payoutIdempotencyKey = `payroll:${run.id}:${item.id}:nomba:${attempt}`;
    const claimed = await this.payrollItems.manager.transaction(async (manager) => {
      const itemClaimed = await updatePayrollItemScopedIfStatus(
        manager.getRepository(PayrollItem),
        item.id,
        tenantId,
        item.status,
        {
          status: PayrollItemStatus.PROCESSING,
          paymentProvider: 'Nomba',
          transactionId: merchantTxRef,
          failureReason: null,
          metadata: {
            ...(item.metadata ?? {}),
            nombaPayoutAttempt: attempt,
            nombaMerchantTxRef: merchantTxRef,
          },
        },
      );
      if (!itemClaimed) return false;
      await this.attemptHistory.beginPayoutAttempt(
        {
          tenantId,
          payrollRunId: run.id,
          payrollItemId: item.id,
          provider: 'nomba',
          attemptNumber: attempt,
          merchantReference: merchantTxRef,
          idempotencyKey: payoutIdempotencyKey,
          destinationAmount: String(item.paymentAmount),
          destinationCurrency: 'NGN',
          initialStatus: 'processing',
          metadata: {
            payoutFeeReserveNgn: process.env.PAYROLL_PAYOUT_FEE_NOMBA_NGN ?? null,
            paqadhrTransferChargeNgn: process.env.PAYROLL_NOMBA_TRANSFER_CHARGE_NGN ?? '50',
          },
        },
        manager,
      );
      return true;
    });
    if (!claimed) {
      return {
        success: false,
        outcome: 'failed',
        error: 'Payroll item is no longer eligible for payout.',
        provider: 'Nomba',
        rail: 'bank',
      };
    }

    const amount = Number(item.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      await this.payrollPayouts.applyTransferStatus(
        merchantTxRef,
        'FAILED',
        merchantTxRef,
        undefined,
        tenantId,
      );
      return {
        success: false,
        outcome: 'failed',
        error: 'Payroll payout amount is invalid.',
        provider: 'Nomba',
        rail: 'bank',
      };
    }

    try {
      const response = await this.transfers.bankTransfer({
        amount,
        accountNumber: method.accountNumber,
        accountName: method.accountName,
        bankCode: method.bankCode,
        merchantTxRef,
        senderName: run.tenant?.name ?? 'PaqadHR',
        narration: `Payroll ${run.title}`.slice(0, 100),
      });
      const status = response.data?.status ?? 'PROCESSING';
      const providerReference = response.data?.id ?? merchantTxRef;
      await this.payrollPayouts.applyTransferStatus(
        merchantTxRef,
        status,
        providerReference,
        undefined,
        tenantId,
        response.data?.amount,
      );
      const outcome = this.payrollPayouts.classifyPaymentResultStatus(status);
      return {
        success: outcome === 'paid',
        outcome,
        transactionId: providerReference,
        reference: merchantTxRef,
        provider: 'Nomba',
        providerStatus: status,
        rail: 'bank',
      };
    } catch {
      // Submission may have reached Nomba even if the response was lost. Preserve PROCESSING
      // with the same merchant reference; webhook/status reconciliation resolves it before retry.
      const providerStatus = await this.transfers.getTransactionStatus(merchantTxRef);
      if (providerStatus) {
        await this.payrollPayouts.applyTransferStatus(
          merchantTxRef,
          providerStatus,
          merchantTxRef,
          undefined,
          tenantId,
        );
        const outcome = this.payrollPayouts.classifyPaymentResultStatus(providerStatus);
        return {
          success: outcome === 'paid',
          outcome,
          transactionId: merchantTxRef,
          reference: merchantTxRef,
          provider: 'Nomba',
          providerStatus,
          rail: 'bank',
        };
      }
      return {
        success: false,
        outcome: 'processing',
        transactionId: merchantTxRef,
        reference: merchantTxRef,
        provider: 'Nomba',
        providerStatus: 'UNKNOWN',
        rail: 'bank',
        error: 'Nomba submission outcome is unknown and is being reconciled before retry.',
      };
    }
  }

  decryptBankDetails(method: PaymentMethod): void {
    if (method.accountNumber && this.encryption.isEncrypted(method.accountNumber)) {
      method.accountNumber = this.encryption.decrypt(method.accountNumber);
    }
    if (method.accountName && this.encryption.isEncrypted(method.accountName)) {
      method.accountName = this.encryption.decrypt(method.accountName);
    }
  }
}
