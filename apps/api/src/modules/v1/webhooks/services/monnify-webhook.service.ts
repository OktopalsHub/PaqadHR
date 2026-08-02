import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { TenantWalletVirtualAccountService } from '../../rewards/services/tenant-wallet-virtual-account.service';
import { extractMonnifyVirtualAccountDeposit } from '../webhook-request.util';

@Injectable()
export class MonnifyWebhookService {
  constructor(private readonly walletVirtualAccountService: TenantWalletVirtualAccountService) {}

  async dispatch(rawBody: string, signature: string): Promise<{ received: boolean }> {
    if (!signature?.trim()) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    if (!verifyMonnifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook JSON');
    }

    const deposit = extractMonnifyVirtualAccountDeposit(payload);
    if (!deposit) {
      return { received: true };
    }

    return this.walletVirtualAccountService.completeVirtualAccountDeposit({
      provider: PaymentProvider.MONNIFY,
      ...deposit,
    });
  }
}
