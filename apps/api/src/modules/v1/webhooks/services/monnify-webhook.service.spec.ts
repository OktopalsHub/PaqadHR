import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { MonnifyWebhookService } from './monnify-webhook.service';

jest.mock('src/common/config/monnify-webhook.util', () => ({
  verifyMonnifyWebhookSignature: jest.fn(),
}));

jest.mock('src/common/config/monnify.config', () => ({
  isMonnifyLive: jest.fn(),
}));

import { isMonnifyLive } from 'src/common/config/monnify.config';
import { verifyMonnifyWebhookSignature } from 'src/common/config/monnify-webhook.util';

describe('MonnifyWebhookService', () => {
  let service: MonnifyWebhookService;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;
  let subscriptionBillingService: jest.Mocked<
    Pick<SubscriptionBillingService, 'processMonnifyPayload'>
  >;
  let payrollPayoutService: { processMonnifyPayload: jest.Mock };

  beforeEach(() => {
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
    };
    subscriptionBillingService = {
      processMonnifyPayload: jest.fn().mockResolvedValue({ received: true }),
    };
    payrollPayoutService = {
      processMonnifyPayload: jest.fn().mockResolvedValue({ received: true, matched: true }),
    };

    service = new MonnifyWebhookService(
      walletTopupService as unknown as TenantWalletTopupService,
      subscriptionBillingService as unknown as SubscriptionBillingService,
      payrollPayoutService as never,
    );
    (verifyMonnifyWebhookSignature as jest.Mock).mockReturnValue(true);
    (isMonnifyLive as jest.Mock).mockReturnValue(false);
  });

  it('rejects missing signature in live mode', async () => {
    (isMonnifyLive as jest.Mock).mockReturnValue(true);
    await expect(service.dispatch('{}', '')).rejects.toThrow(UnauthorizedException);
  });

  it('accepts missing signature in sandbox and processes wallet top-up', async () => {
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        amountPaid: 2500,
        paymentReference: 'wm_11111111111141118111111111111111_abc',
        metaData: { tenantId: '11111111-1111-4111-8111-111111111111', billingType: 'wallet_topup' },
      },
    });

    await service.dispatch(body, '');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalled();
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
    expect(payrollPayoutService.processMonnifyPayload).not.toHaveBeenCalled();
  });

  it('returns 503 when wallet verify is still pending', async () => {
    walletTopupService.completeCheckoutTopup.mockResolvedValue({
      received: true,
      credited: false,
      retryable: true,
    });
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        amountPaid: 2500,
        paymentReference: 'wm_11111111111141118111111111111111_abc',
        metaData: { billingType: 'wallet_topup', tenantId: '11111111-1111-4111-8111-111111111111' },
      },
    });

    await expect(service.dispatch(body, 'sig')).rejects.toThrow(ServiceUnavailableException);
  });

  it('routes wm_ wallet refs even when meta billingType is missing', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const paymentReference = `wm_${tenantId.replace(/-/g, '')}_abc123`;
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        amountPaid: 2500,
        paymentReference,
        metaData: {},
      },
    });

    await service.dispatch(body, 'sig');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith(
      {
        tenantId,
        orderReference: paymentReference,
        amount: 2500,
      },
      'monnify',
    );
  });

  it('routes payroll disbursement references to payroll payout service', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const itemId = '22222222-2222-4222-8222-222222222222';
    const body = JSON.stringify({
      eventType: 'SUCCESSFUL_DISBURSEMENT',
      eventData: {
        reference: `payroll_${runId}_${itemId}`,
        amount: 5000,
        status: 'SUCCESS',
      },
    });

    await service.dispatch(body, 'sig');

    expect(payrollPayoutService.processMonnifyPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantRef: `payroll_${runId}_${itemId}`,
        status: 'SUCCESS',
      }),
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
    expect(payrollPayoutService.processMonnifyPayload).not.toHaveBeenCalled();
  });
});
