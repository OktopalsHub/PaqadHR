import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isMonnifyLive } from 'src/common/config/monnify.config';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractMonnifyPayrollTransfer,
  extractMonnifySubscriptionPayment,
  extractMonnifyWalletTopupCheckout,
} from '../webhook-request.util';

@Injectable()
export class MonnifyWebhookService {
  private readonly logger = new Logger(MonnifyWebhookService.name);

  constructor(
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    const trimmedSig = signature?.trim() ?? '';
    if (!trimmedSig) {
      // Monnify docs: monnify-signature is production-only; sandbox omits it.
      if (isMonnifyLive()) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      this.logger.warn('Accepting Monnify sandbox webhook without signature header');
    } else if (!verifyMonnifyWebhookSignature(rawBody, trimmedSig)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const walletTopup = extractMonnifyWalletTopupCheckout(payload);
    if (walletTopup) {
      const result = await this.walletTopupService.completeCheckoutTopup(
        walletTopup,
        PaymentProvider.MONNIFY,
      );
      if (result.retryable) {
        throw new ServiceUnavailableException('Wallet top-up verification pending');
      }
      return { received: result.received };
    }

    const payrollTransfer = extractMonnifyPayrollTransfer(payload);
    if (payrollTransfer) {
      await this.payrollPayoutService.processMonnifyPayload(payrollTransfer);
      return { received: true };
    }

    const subscriptionPayment = extractMonnifySubscriptionPayment(payload);
    if (subscriptionPayment) {
      return this.subscriptionBillingService.processMonnifyPayload(payload);
    }

    return { received: true };
  }
}
