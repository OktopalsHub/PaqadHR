import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { FincraApiService } from 'src/common/services/fincra-api.service';
import { NoahApiService } from 'src/common/services/noah-api.service';
import { NombaTransferApiService } from 'src/common/services/nomba-transfer-api.service';
import { PayrollItemRepository } from '../repositories/payroll-item.repository';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PAYROLL_MERCHANT_REF_PATTERN } from '../utils/payroll-merchant-ref.util';
import { PayoutReconciliation } from './payout-reconciliation';

@Injectable()
export class PayoutWebhooks {
  private readonly logger = new Logger(PayoutWebhooks.name);
  constructor(
    private readonly nombaTransferApi: NombaTransferApiService,
    private readonly noahApi: NoahApiService,
    private readonly fincraApi: FincraApiService,
    private readonly payrollItemRepository: PayrollItemRepository,
    readonly _payrollRunRepository: PayrollRunRepository,
    private readonly reconciliation: PayoutReconciliation,
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

  async handleNoahWebhook(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim() || !this.noahApi.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Rejected Noah payroll webhook: invalid signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }
    return this.processNoahPayload(payload);
  }

  async processNombaPayload(payload: unknown): Promise<{ received: boolean }> {
    const event = this.nombaTransferApi.parseTransferWebhook(payload);
    if (!event) return { received: true };

    const merchantRef = event.merchantTxRef ?? event.reference;
    const parsed = PAYROLL_MERCHANT_REF_PATTERN.exec(merchantRef);
    const tenantId = parsed ? await this.reconciliation.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) return { received: true };

    const changed = await this.reconciliation.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOMBA,
      tenantId,
    );
    if (changed && parsed) {
      await this.reconciliation.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true };
  }

  async processNoahPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.noahApi.parseTransferWebhook(payload);
    if (!event) return { received: true, matched: false };

    let merchantRef = event.merchantTxRef ?? event.reference;
    if (!merchantRef || !PAYROLL_MERCHANT_REF_PATTERN.test(merchantRef)) {
      if (!event.reference) return { received: true, matched: false };
      const item = await this.payrollItemRepository.findOne({
        where: { transactionId: event.reference },
        relations: ['payrollRun'],
      });
      if (!item) return { received: true, matched: false };
      merchantRef = `payroll_${item.payrollRunId}_${item.id}`;
    }

    const parsed = PAYROLL_MERCHANT_REF_PATTERN.exec(merchantRef);
    const tenantId = parsed ? await this.reconciliation.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) return { received: true, matched: true };

    const changed = await this.reconciliation.applyTransferStatus(
      merchantRef,
      event.status,
      event.reference,
      PaymentProvider.NOAH,
      tenantId,
    );
    if (changed) {
      await this.reconciliation.reconcilePayrollRunStatus(parsed![1], tenantId);
    }
    return { received: true, matched: true };
  }

  async processFincraPayload(payload: unknown): Promise<{ received: boolean; matched: boolean }> {
    const event = this.fincraApi.parsePayoutWebhook(payload);
    if (!event) return { received: true, matched: false };

    const parsed = PAYROLL_MERCHANT_REF_PATTERN.exec(event.merchantRef);
    const tenantId = parsed ? await this.reconciliation.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) return { received: true, matched: false };

    let reference = event.reference;
    let amount = event.amount;
    let status: string;

    try {
      const verified = await this.fincraApi.getPayoutStatus(event.merchantRef);
      if (!verified) {
        this.logger.warn(`Fincra payout webhook ignored: no payout found for ${event.merchantRef}`);
        return { received: true, matched: false };
      }
      status = verified.status;
      reference = verified.reference ?? reference;
      amount = verified.amount ?? amount;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Fincra payout webhook verification failed for ${event.merchantRef}: ${message}`,
      );
      return { received: true, matched: false };
    }

    const changed = await this.reconciliation.applyTransferStatus(
      event.merchantRef,
      status,
      reference,
      PaymentProvider.FINCRA,
      tenantId,
      amount,
    );
    if (changed && parsed) {
      await this.reconciliation.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true, matched: changed };
  }

  async processMonnifyPayload(payload: {
    merchantRef: string;
    transactionId: string;
    status: string;
    amount?: number;
  }): Promise<{ received: boolean; matched: boolean }> {
    const parsed = PAYROLL_MERCHANT_REF_PATTERN.exec(payload.merchantRef);
    const tenantId = parsed ? await this.reconciliation.resolveTenantId(parsed[1]) : undefined;
    if (!tenantId) return { received: true, matched: false };

    const changed = await this.reconciliation.applyTransferStatus(
      payload.merchantRef,
      payload.status,
      payload.transactionId,
      PaymentProvider.MONNIFY,
      tenantId,
      payload.amount,
    );
    if (changed && parsed) {
      await this.reconciliation.reconcilePayrollRunStatus(parsed[1], tenantId);
    }
    return { received: true, matched: changed };
  }
}
