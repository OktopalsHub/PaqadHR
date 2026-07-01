import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { LessThan, Repository } from 'typeorm';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';

const PAYROLL_REF_PATTERN = /^payroll_([0-9a-f-]{36})_([0-9a-f-]{36})$/i;

const SUCCESS_STATUSES = new Set(['SUCCESS', 'COMPLETED', 'PAYMENT_SUCCESSFUL']);
const PENDING_STATUSES = new Set(['PENDING', 'PENDING_BILLING', 'PROCESSING']);
const FAILED_STATUSES = new Set(['FAILED', 'REFUND', 'REVERSED', 'CANCELLED']);

@Injectable()
export class PayrollPayoutService {
  private readonly logger = new Logger(PayrollPayoutService.name);

  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly payrollItemRepository: PayrollItemRepository,
    private readonly payrollRunRepository: PayrollRunRepository,
    @InjectRepository(PayrollItem)
    private readonly payrollItemRepo: Repository<PayrollItem>,
  ) {}

  async handleNombaWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim() || !this.nombaTransferApi.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected Nomba payroll webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    return this.processNombaPayload(payload);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    const event = this.nombaTransferApi.parseTransferWebhook(payload);
    if (!event) {
      return { received: true };
    }

    const merchantRef = event.merchantTxRef ?? event.reference;
    const changed = await this.applyTransferStatus(merchantRef, event.status, event.reference);
    if (changed) {
      const parsed = PAYROLL_REF_PATTERN.exec(merchantRef);
      if (parsed) {
        await this.reconcilePayrollRunStatus(parsed[1]);
      }
    }
    return { received: true };
  }

  async requeryStuckPayouts(): Promise<{ checked: number; updated: number }> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const stuckItems = await this.payrollItemRepo.find({
      where: {
        status: PayrollItemStatus.PROCESSING,
        updatedAt: LessThan(cutoff),
      },
      take: 50,
    });

    let updated = 0;
    for (const item of stuckItems) {
      const reference = item.transactionId;
      if (!reference) continue;

      const status = await this.nombaTransferApi.getTransactionStatus(reference);
      if (!status) continue;

      const changed = await this.applyTransferStatus(
        `payroll_${item.payrollRunId}_${item.id}`,
        status.toUpperCase(),
        reference,
      );
      if (changed) {
        updated += 1;
        await this.reconcilePayrollRunStatus(item.payrollRunId);
      }
    }

    return { checked: stuckItems.length, updated };
  }

  async applyTransferStatus(
    merchantRef: string,
    rawStatus: string,
    transactionId: string,
  ): Promise<boolean> {
    const parsed = PAYROLL_REF_PATTERN.exec(merchantRef);
    if (!parsed) {
      return false;
    }

    const [, payrollRunId, itemId] = parsed;
    const item = await this.payrollItemRepository.findOne({
      where: { id: itemId, payrollRunId },
    });
    if (!item) {
      return false;
    }

    const status = rawStatus.toUpperCase();

    if (SUCCESS_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.PAID) return false;
      item.status = PayrollItemStatus.PAID;
      item.transactionId = transactionId;
      item.paymentProvider = 'Nomba';
      item.paidAt = new Date();
      item.failureReason = null;
      await this.payrollItemRepository.save(item);
      this.logger.log(`Payroll item ${itemId} marked paid via transfer status ${status}`);
      return true;
    }

    if (FAILED_STATUSES.has(status)) {
      if (item.status === PayrollItemStatus.FAILED) return false;
      item.status = PayrollItemStatus.FAILED;
      item.transactionId = transactionId;
      item.failureReason = `Nomba transfer ${status.toLowerCase()}`;
      await this.payrollItemRepository.save(item);
      this.logger.warn(`Payroll item ${itemId} failed: ${status}`);
      return true;
    }

    if (PENDING_STATUSES.has(status) && item.status === PayrollItemStatus.PENDING) {
      item.status = PayrollItemStatus.PROCESSING;
      item.transactionId = transactionId;
      await this.payrollItemRepository.save(item);
      return true;
    }

    return false;
  }

  classifyPaymentResultStatus(rawStatus?: string): 'paid' | 'processing' | 'failed' {
    const status = (rawStatus ?? '').toUpperCase();
    if (SUCCESS_STATUSES.has(status)) return 'paid';
    if (FAILED_STATUSES.has(status)) return 'failed';
    return 'processing';
  }

  async reconcilePayrollRunStatus(payrollRunId: string): Promise<void> {
    const items = await this.payrollItemRepository.find({
      where: { payrollRunId },
    });
    if (items.length === 0) {
      return;
    }

    const run = await this.payrollRunRepository.findOne({ where: { id: payrollRunId } });
    if (!run) {
      return;
    }

    let pending = 0;
    let processing = 0;
    let paid = 0;
    let failed = 0;

    for (const item of items) {
      switch (item.status) {
        case PayrollItemStatus.PENDING:
          pending += 1;
          break;
        case PayrollItemStatus.PROCESSING:
          processing += 1;
          break;
        case PayrollItemStatus.PAID:
          paid += 1;
          break;
        case PayrollItemStatus.FAILED:
          failed += 1;
          break;
        default:
          break;
      }
    }

    const inFlight = pending + processing;

    if (inFlight > 0) {
      run.status = PayrollStatus.PROCESSING;
    } else if (paid === items.length) {
      run.status = PayrollStatus.COMPLETED;
      run.processedAt = run.processedAt ?? new Date();
    } else if (failed === items.length) {
      run.status = PayrollStatus.FAILED;
    } else if (paid > 0 && failed > 0) {
      run.status = PayrollStatus.PROCESSING;
    } else if (paid > 0) {
      run.status = PayrollStatus.COMPLETED;
      run.processedAt = run.processedAt ?? new Date();
    } else {
      run.status = PayrollStatus.FAILED;
    }

    await this.payrollRunRepository.save(run);
    this.logger.log(`Payroll run ${payrollRunId} reconciled to ${run.status}`);
  }
}
