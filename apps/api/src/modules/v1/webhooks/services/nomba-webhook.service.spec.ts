import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { TenantWalletVirtualAccountService } from '../../rewards/services/tenant-wallet-virtual-account.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { extractWalletTopupCheckout, NombaWebhookService } from './nomba-webhook.service';

jest.mock('src/common/config/nomba-webhook.util', () => ({
  verifyNombaWebhookSignature: jest.fn(),
}));

import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';

describe('extractWalletTopupCheckout', () => {
  it('extracts wallet_topup payment_success meta', () => {
    expect(
      extractWalletTopupCheckout({
        event_type: 'payment_success',
        data: {
          order: {
            orderReference: 'wallet-topup-t1-abc',
            amount: 2500,
            orderMetaData: {
              tenantId: 't1',
              billingType: 'wallet_topup',
              expectedAmount: '2500',
            },
          },
        },
      }),
    ).toEqual({
      tenantId: 't1',
      orderReference: 'wallet-topup-t1-abc',
      amount: 2500,
    });
  });

  it('returns null for subscription payments', () => {
    expect(
      extractWalletTopupCheckout({
        event_type: 'payment_success',
        data: {
          order: {
            orderReference: 'sub_t1_1',
            orderMetaData: { tenantId: 't1', billingType: 'subscription' },
          },
        },
      }),
    ).toBeNull();
  });
});

describe('NombaWebhookService', () => {
  let service: NombaWebhookService;
  let subscriptionBilling: jest.Mocked<Pick<SubscriptionBillingService, 'processNombaPayload'>>;
  let payrollPayout: jest.Mocked<Pick<PayrollPayoutService, 'processNombaPayload'>>;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;
  let walletVirtualAccountService: jest.Mocked<
    Pick<TenantWalletVirtualAccountService, 'completeVirtualAccountDeposit'>
  >;

  beforeEach(() => {
    subscriptionBilling = { processNombaPayload: jest.fn().mockResolvedValue({ received: true }) };
    payrollPayout = { processNombaPayload: jest.fn().mockResolvedValue({ received: true }) };
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
    };
    walletVirtualAccountService = {
      completeVirtualAccountDeposit: jest.fn().mockResolvedValue({
        received: true,
        credited: true,
      }),
    };

    service = new NombaWebhookService(
      subscriptionBilling as unknown as SubscriptionBillingService,
      payrollPayout as unknown as PayrollPayoutService,
      walletTopupService as unknown as TenantWalletTopupService,
      walletVirtualAccountService as unknown as TenantWalletVirtualAccountService,
    );

    (verifyNombaWebhookSignature as jest.Mock).mockReturnValue(true);
  });

  it('rejects missing signature', async () => {
    await expect(service.dispatch('{}', '')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    (verifyNombaWebhookSignature as jest.Mock).mockReturnValue(false);
    await expect(service.dispatch('{}', 'bad')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid JSON', async () => {
    await expect(service.dispatch('{bad', 'sig')).rejects.toThrow(BadRequestException);
  });

  it('routes payment_success to subscription billing', async () => {
    const body = JSON.stringify({ event_type: 'payment_success', data: {} });

    await service.dispatch(body, 'sig');

    expect(subscriptionBilling.processNombaPayload).toHaveBeenCalled();
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(walletVirtualAccountService.completeVirtualAccountDeposit).not.toHaveBeenCalled();
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
  });

  it('routes wallet_topup payment_success to wallet credit', async () => {
    const body = JSON.stringify({
      event_type: 'payment_success',
      data: {
        order: {
          orderReference: 'wallet-topup-t1-abc',
          amount: 2500,
          orderMetaData: {
            tenantId: 't1',
            billingType: 'wallet_topup',
            expectedAmount: '2500',
          },
        },
      },
    });

    await service.dispatch(body, 'sig');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith({
      tenantId: 't1',
      orderReference: 'wallet-topup-t1-abc',
      amount: 2500,
    });
    expect(walletVirtualAccountService.completeVirtualAccountDeposit).not.toHaveBeenCalled();
    expect(subscriptionBilling.processNombaPayload).not.toHaveBeenCalled();
  });

  it('routes payroll merchant ref before ignoring VA deposits', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const itemId = '22222222-2222-4222-8222-222222222222';
    const body = JSON.stringify({
      event_type: 'transfer.success',
      data: { meta: { merchantTxRef: `payroll_${runId}_${itemId}` } },
    });

    await service.dispatch(body, 'sig');

    expect(payrollPayout.processNombaPayload).toHaveBeenCalled();
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(walletVirtualAccountService.completeVirtualAccountDeposit).not.toHaveBeenCalled();
  });

  it('routes VA deposit events to wallet credit', async () => {
    const body = JSON.stringify({
      event_type: 'deposit.success',
      data: {
        virtualAccount: { accountNumber: '1234567890', accountRef: 'rw_nom_t1_1234' },
        amount: 100,
        transactionReference: 'ref-1',
      },
    });

    await service.dispatch(body, 'sig');

    expect(walletVirtualAccountService.completeVirtualAccountDeposit).toHaveBeenCalledWith({
      provider: 'nomba',
      amount: 100,
      transactionReference: 'ref-1',
      accountReference: 'rw_nom_t1_1234',
      accountNumber: '1234567890',
      paymentReference: undefined,
      payerName: undefined,
      rawPayload: {
        event_type: 'deposit.success',
        data: {
          virtualAccount: { accountNumber: '1234567890', accountRef: 'rw_nom_t1_1234' },
          amount: 100,
          transactionReference: 'ref-1',
        },
      },
    });
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(subscriptionBilling.processNombaPayload).not.toHaveBeenCalled();
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
  });

  it('returns received for unknown events', async () => {
    const result = await service.dispatch(JSON.stringify({ event_type: 'unknown.event' }), 'sig');

    expect(result).toEqual({ received: true });
    expect(subscriptionBilling.processNombaPayload).not.toHaveBeenCalled();
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(walletVirtualAccountService.completeVirtualAccountDeposit).not.toHaveBeenCalled();
  });
});
