import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { RewardsService } from '../../rewards/services/rewards.service';
import { TenantWalletService } from '../../rewards/services/tenant-wallet.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractNombaEventType,
  extractPayrollMerchantRef,
  isSubscriptionPaymentEvent,
  isWalletFundingEvent,
} from '../webhook-request.util';

/** Checkout wallet top-up shares payment_success with subscriptions; route by order meta. */
export function extractWalletTopupCheckout(payload: unknown): {
  tenantId: string;
  orderReference: string;
  amount?: number;
} | null {
  const body = payload as {
    event_type?: string;
    eventType?: string;
    data?: {
      orderReference?: string;
      amount?: number;
      meta?: Record<string, unknown>;
      order?: {
        orderReference?: string;
        amount?: number;
        orderMetaData?: Record<string, string>;
      };
    };
  };
  const eventType = (body.event_type || body.eventType || '').toLowerCase();
  if (eventType !== 'payment_success') return null;

  const data = body.data;
  const order = data?.order;
  const orderMeta = order?.orderMetaData ?? {};
  const billingType = orderMeta.billingType ?? data?.meta?.billingType;
  if (billingType !== 'wallet_topup') return null;

  const tenantId = orderMeta.tenantId ?? data?.meta?.tenantId;
  const orderReference = order?.orderReference ?? data?.orderReference;
  if (!tenantId || !orderReference) return null;

  const expectedRaw = orderMeta.expectedAmount ?? data?.meta?.expectedAmount;
  const expectedAmount =
    expectedRaw !== undefined && expectedRaw !== null && String(expectedRaw).trim() !== ''
      ? Number(expectedRaw)
      : undefined;
  const amountFromOrder = Number(order?.amount ?? data?.amount ?? 0);

  return {
    tenantId: String(tenantId),
    orderReference: String(orderReference),
    amount: Number.isFinite(expectedAmount) ? expectedAmount : amountFromOrder || undefined,
  };
}

@Injectable()
export class NombaWebhookService {
  private readonly logger = new Logger(NombaWebhookService.name);

  constructor(
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
    private readonly rewardsService: RewardsService,
    private readonly walletService: TenantWalletService,
  ) {}

  async dispatch(
    rawBody: string,
    signature: string,
    timestamp?: string,
  ): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyNombaWebhookSignature(rawBody, signature, timestamp)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const eventType = extractNombaEventType(payload);

    if (isSubscriptionPaymentEvent(eventType)) {
      const walletTopup = extractWalletTopupCheckout(payload);
      if (walletTopup) {
        return this.walletService.completeCheckoutTopup(walletTopup);
      }
      return this.subscriptionBillingService.processNombaPayload(payload);
    }

    if (extractPayrollMerchantRef(payload)) {
      return this.payrollPayoutService.processNombaPayload(payload);
    }

    if (isWalletFundingEvent(eventType)) {
      return this.rewardsService.processNombaFundingPayload(payload);
    }

    this.logger.debug(`Ignoring unhandled Nomba webhook event: ${eventType || 'unknown'}`);
    return { received: true };
  }
}
