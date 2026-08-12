import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { BachsWebhookService } from './bachs-webhook.service';

jest.mock('src/common/config/bachs-webhook.util', () => ({
  verifyBachsWebhookSignature: jest.fn(),
}));

import { verifyBachsWebhookSignature } from 'src/common/config/bachs-webhook.util';

describe('BachsWebhookService', () => {
  let service: BachsWebhookService;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;
  let subscriptionBillingService: jest.Mocked<
    Pick<SubscriptionBillingService, 'processBachsPayload'>
  >;

  beforeEach(() => {
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
    };
    subscriptionBillingService = {
      processBachsPayload: jest.fn().mockResolvedValue({ received: true }),
    };

    service = new BachsWebhookService(
      subscriptionBillingService as unknown as SubscriptionBillingService,
      walletTopupService as unknown as TenantWalletTopupService,
    );
    (verifyBachsWebhookSignature as jest.Mock).mockReturnValue(true);
  });

  it('rejects missing signature headers', async () => {
    await expect(service.dispatch('{}', '', '123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    (verifyBachsWebhookSignature as jest.Mock).mockReturnValue(false);
    await expect(service.dispatch('{}', 'sig', '123')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid JSON', async () => {
    await expect(service.dispatch('{bad', 'sig', '123')).rejects.toThrow(BadRequestException);
  });

  it('routes wallet_topup collection.succeeded to wallet credit', async () => {
    const body = JSON.stringify({
      type: 'collection.succeeded',
      data: {
        reference: 'wb_tenant_ref',
        amount: '2500.00',
        metadata: {
          tenantId: 't1',
          billingType: 'wallet_topup',
          expectedAmount: '2500',
        },
      },
    });

    await service.dispatch(body, 'sig', '123');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith(
      {
        tenantId: 't1',
        orderReference: 'wb_tenant_ref',
        amount: 2500,
      },
      'bachs',
    );
    expect(subscriptionBillingService.processBachsPayload).not.toHaveBeenCalled();
  });

  it('falls through to subscription billing for non-wallet events', async () => {
    const body = JSON.stringify({
      type: 'invoice.paid',
      data: { metadata: { billingType: 'subscription' } },
    });

    await service.dispatch(body, 'sig', '123');

    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(subscriptionBillingService.processBachsPayload).toHaveBeenCalled();
  });
});
