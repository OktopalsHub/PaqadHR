import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollFloatTopupService } from '../../payroll/services/payroll-float-topup.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import {
  extractMonnifyPayrollFloatTopupCheckout,
  extractMonnifyPayrollTransfer,
  extractMonnifySubscriptionPayment,
  extractMonnifyWalletTopupCheckout,
} from '../webhook-request.util';

@Injectable()
export class MonnifyWebhookService {
  constructor(
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly subscriptionBillingService: SubscriptionBillingService,
    private readonly payrollFloatTopupService: PayrollFloatTopupService,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    const trimmedSig = signature?.trim() ?? '';
    if (!trimmedSig) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyMonnifyWebhookSignature(rawBody, trimmedSig)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const payrollFloatTopup = extractMonnifyPayrollFloatTopupCheckout(payload);
    if (payrollFloatTopup) {
      const result = await this.payrollFloatTopupService.completeFloatTopup(payrollFloatTopup);
      return { received: result.received };
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
