import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { MonnifyWebhookService } from './monnify-webhook.service';

jest.mock('src/common/config/monnify-webhook.util', () => ({
  verifyMonnifyWebhookSignature: jest.fn(),
}));

import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';

describe('MonnifyWebhookService', () => {
  let service: MonnifyWebhookService;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;
  let subscriptionBillingService: jest.Mocked<
    Pick<SubscriptionBillingService, 'processMonnifyPayload'>
  >;

  beforeEach(() => {
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true }),
    };
    subscriptionBillingService = {
      processMonnifyPayload: jest.fn().mockResolvedValue({ received: true }),
    };

    service = new MonnifyWebhookService(
      walletTopupService as unknown as TenantWalletTopupService,
      subscriptionBillingService as unknown as SubscriptionBillingService,
    );
    (verifyMonnifyWebhookSignature as jest.Mock).mockReturnValue(true);
  });

  it('rejects missing signature', async () => {
    await expect(service.dispatch('{}', '')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    (verifyMonnifyWebhookSignature as jest.Mock).mockReturnValue(false);
    await expect(service.dispatch('{}', 'bad')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid JSON', async () => {
    await expect(service.dispatch('{bad', 'sig')).rejects.toThrow(BadRequestException);
  });

  it('routes wallet_topup checkout to wallet credit', async () => {
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        amountPaid: 2500,
        paymentReference: 'wallet-topup-t1-abc',
        metaData: {
          tenantId: 't1',
          billingType: 'wallet_topup',
          expectedAmount: '2500',
        },
      },
    });

    await service.dispatch(body, 'sig');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith(
      {
        tenantId: 't1',
        orderReference: 'wallet-topup-t1-abc',
        amount: 2500,
      },
      'monnify',
    );
    expect(subscriptionBillingService.processMonnifyPayload).not.toHaveBeenCalled();
  });

  it('ignores unrelated events', async () => {
    const result = await service.dispatch(
      JSON.stringify({ eventType: 'FAILED_TRANSACTION' }),
      'sig',
    );

    expect(result).toEqual({ received: true });
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(subscriptionBillingService.processMonnifyPayload).not.toHaveBeenCalled();
  });
});
