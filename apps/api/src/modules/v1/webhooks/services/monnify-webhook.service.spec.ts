import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { TenantWalletVirtualAccountService } from '../../rewards/services/tenant-wallet-virtual-account.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { MonnifyWebhookService } from './monnify-webhook.service';

jest.mock('src/common/config/monnify-webhook.util', () => ({
  verifyMonnifyWebhookSignature: jest.fn(),
}));

import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';

describe('MonnifyWebhookService', () => {
  let service: MonnifyWebhookService;
  let walletVirtualAccountService: jest.Mocked<
    Pick<TenantWalletVirtualAccountService, 'completeVirtualAccountDeposit'>
  >;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;
  let subscriptionBillingService: jest.Mocked<
    Pick<SubscriptionBillingService, 'processMonnifyPayload'>
  >;

  beforeEach(() => {
    walletVirtualAccountService = {
      completeVirtualAccountDeposit: jest.fn().mockResolvedValue({
        received: true,
        credited: true,
      }),
    };
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true }),
    };
    subscriptionBillingService = {
      processMonnifyPayload: jest.fn().mockResolvedValue({ received: true }),
    };

    service = new MonnifyWebhookService(
      walletVirtualAccountService as unknown as TenantWalletVirtualAccountService,
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

  it('routes successful transaction events to wallet credit', async () => {
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        amountPaid: 2500,
        paymentReference: 'pay-ref-1',
        product: { reference: 'rw_mon_t1_1234' },
        destinationAccountInformation: { accountNumber: '1234567890' },
        payer: { name: 'Ada Lovelace' },
      },
    });

    await service.dispatch(body, 'sig');

    expect(walletVirtualAccountService.completeVirtualAccountDeposit).toHaveBeenCalledWith({
      provider: 'monnify',
      amount: 2500,
      transactionReference: 'pay-ref-1',
      accountReference: 'rw_mon_t1_1234',
      accountNumber: '1234567890',
      paymentReference: 'pay-ref-1',
      payerName: 'Ada Lovelace',
      rawPayload: {
        eventType: 'SUCCESSFUL_TRANSACTION',
        eventData: {
          amountPaid: 2500,
          paymentReference: 'pay-ref-1',
          product: { reference: 'rw_mon_t1_1234' },
          destinationAccountInformation: { accountNumber: '1234567890' },
          payer: { name: 'Ada Lovelace' },
        },
      },
    });
  });

  it('ignores unrelated events', async () => {
    const result = await service.dispatch(
      JSON.stringify({ eventType: 'FAILED_TRANSACTION' }),
      'sig',
    );

    expect(result).toEqual({ received: true });
    expect(walletVirtualAccountService.completeVirtualAccountDeposit).not.toHaveBeenCalled();
  });
});
