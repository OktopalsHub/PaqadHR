import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { isFincraAllowUnsignedWebhooks, isFincraLive } from 'src/common/config/fincra.config';
import {
  extractFincraWalletTopupCheckout,
  verifyFincraWebhookSignature,
} from 'src/common/config/fincra-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';

@Injectable()
export class FincraWebhookService {
  private readonly logger = new Logger(FincraWebhookService.name);

  constructor(
    private readonly walletTopupService: TenantWalletTopupService,
    private readonly payrollPayoutService: PayrollPayoutService,
  ) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    const trimmedSig = signature?.trim() ?? '';
    if (!trimmedSig) {
      if (isFincraLive() || !isFincraAllowUnsignedWebhooks()) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      this.logger.warn(
        'Accepting Fincra webhook without signature (FINCRA_ALLOW_UNSIGNED_WEBHOOKS=true)',
      );
    } else if (!verifyFincraWebhookSignature(rawBody, trimmedSig)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const walletTopup = extractFincraWalletTopupCheckout(payload);
    if (walletTopup) {
      const result = await this.walletTopupService.completeCheckoutTopup(
        walletTopup,
        PaymentProvider.FINCRA,
      );
      if (result.retryable) {
        throw new ServiceUnavailableException('Wallet top-up verification pending');
      }
      return { received: result.received };
    }

    await this.payrollPayoutService.processFincraPayload(payload);
    return { received: true };
  }
}
