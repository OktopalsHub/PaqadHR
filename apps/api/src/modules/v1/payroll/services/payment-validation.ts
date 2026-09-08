import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import type { PaymentResult } from '../../../../common/interfaces/payment-result.interface';
import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';

interface PaymentSummary {
  bankSuccess: number;
  bankFailed: number;
  cryptoSuccess: number;
  cryptoFailed: number;
  fiatSuccess: number;
  fiatFailed: number;
}

export class PaymentValidation {
  constructor(private readonly payrollItemRepository: PayrollItemRepository) {}

  calculatePaymentSummary(results: PaymentResult[]): PaymentSummary {
    const bank = results.filter((r) => r.rail !== 'crypto');
    const crypto = results.filter((r) => r.rail === 'crypto');
    const bankSuccess = bank.filter((r) => r.success).length;
    const bankFailed = bank.filter((r) => !r.success).length;
    const cryptoSuccess = crypto.filter((r) => r.success).length;
    const cryptoFailed = crypto.filter((r) => !r.success).length;
    return {
      bankSuccess,
      bankFailed,
      cryptoSuccess,
      cryptoFailed,
      fiatSuccess: bankSuccess + cryptoSuccess,
      fiatFailed: bankFailed + cryptoFailed,
    };
  }

  async resetItemsForRetry(items: PayrollItem[]): Promise<void> {
    for (const item of items) {
      const priorRetry =
        typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;
      const metadata = { ...(item.metadata ?? {}), payoutRetryCount: priorRetry + 1 };
      item.status = PayrollItemStatus.PENDING;
      item.failureReason = null;
      item.transactionId = null;
      item.paymentProvider = null;
      item.paidAt = null;
      item.metadata = metadata;
      await this.payrollItemRepository.update(item.id, {
        status: PayrollItemStatus.PENDING,
        failureReason: null,
        transactionId: null,
        paymentProvider: null,
        paidAt: null,
        metadata,
      });
    }
  }

  async getPaymentTypeBreakdown(items: PayrollItem[]) {
    const breakdown = {
      bank: { total: 0, paid: 0, failed: 0, pending: 0 },
      crypto: { total: 0, paid: 0, failed: 0, pending: 0 },
      fiat: { total: 0, paid: 0, failed: 0, pending: 0 },
    };
    for (const item of items) {
      const rail = isCryptoCurrency(item.paymentCurrency) ? 'crypto' : 'bank';
      breakdown[rail].total++;
      breakdown.fiat.total++;
      switch (item.status) {
        case PayrollItemStatus.PAID:
          breakdown[rail].paid++;
          breakdown.fiat.paid++;
          break;
        case PayrollItemStatus.FAILED:
          breakdown[rail].failed++;
          breakdown.fiat.failed++;
          break;
        case PayrollItemStatus.PENDING:
        case PayrollItemStatus.PROCESSING:
          breakdown[rail].pending++;
          breakdown.fiat.pending++;
          break;
      }
    }
    return breakdown;
  }
}
