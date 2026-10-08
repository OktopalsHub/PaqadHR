import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PayrollFloatTopupService } from '../../payroll/services/payroll-float-topup.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { BachsWebhookService } from './bachs-webhook.service';

jest.mock('src/common/config/bachs-webhook.util', () => ({
  verifyBachsWebhookSignature: jest.fn(),
}));

import { verifyBachsWebhookSignature } from 'src/common/config/bachs-webhook.util';

describe('BachsWebhookService', () => {
  let service: BachsWebhookService;
  let walletTopupService: jest.Mocked<
    Pick<TenantWalletTopupService, 'completeCheckoutTopup' | 'persistBachsSavedPaymentMethod'>
  >;
  let subscriptionBillingService: jest.Mocked<
    Pick<SubscriptionBillingService, 'processBachsPayload'>
  >;
  let payrollFloatTopupService: jest.Mocked<Pick<PayrollFloatTopupService, 'completeFloatTopup'>>;
  let payrollPayoutService: jest.Mocked<Pick<PayrollPayoutService, 'processBachsPayload'>>;

  beforeEach(() => {
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
      persistBachsSavedPaymentMethod: jest
        .fn()
        .mockResolvedValue({ received: true, matched: true }),
    };
    subscriptionBillingService = {
      processBachsPayload: jest.fn().mockResolvedValue({ received: true }),
    };
    payrollFloatTopupService = {
      completeFloatTopup: jest.fn().mockResolvedValue({ received: true }),
    };
    payrollPayoutService = {
      processBachsPayload: jest.fn().mockResolvedValue({ received: true, matched: true }),
    };

    service = new BachsWebhookService(
      subscriptionBillingService as unknown as SubscriptionBillingService,
      walletTopupService as unknown as TenantWalletTopupService,
      payrollFloatTopupService as unknown as PayrollFloatTopupService,
      payrollPayoutService as unknown as PayrollPayoutService,
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

  it('routes payment_method.saved to wallet card persistence', async () => {
    const body = JSON.stringify({
      type: 'payment_method.saved',
      data: {
        payment_method_id: 'pm_abc',
        card_brand: 'visa',
        card_last4: '4242',
        customer: {
          customer_id: 'cust_1a2b',
          metadata: { tenantId: '11111111-1111-4111-8111-111111111111' },
        },
      },
    });

    await service.dispatch(body, 'sig', '123');

    expect(walletTopupService.persistBachsSavedPaymentMethod).toHaveBeenCalledWith({
      customerId: 'cust_1a2b',
      paymentMethodId: 'pm_abc',
      tenantId: '11111111-1111-4111-8111-111111111111',
      cardBrand: 'visa',
      cardLastFour: '4242',
    });
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(subscriptionBillingService.processBachsPayload).not.toHaveBeenCalled();
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

  it('routes payout.paid events to the payroll payout handler', async () => {
    const body = JSON.stringify({
      type: 'payout.paid',
      data: {
        withdrawal_id: 'pay_abc123',
        reference: 'pi_abc',
        status: 'completed',
        amount: '825000.00',
        to_amount: '825000.00',
      },
    });

    await service.dispatch(body, 'sig', '123');

    expect(payrollPayoutService.processBachsPayload).toHaveBeenCalledWith(JSON.parse(body));
    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(subscriptionBillingService.processBachsPayload).not.toHaveBeenCalled();
  });

  it('routes payout.failed events to the payroll payout handler', async () => {
    const body = JSON.stringify({
      type: 'payout.failed',
      data: { withdrawal_id: 'pay_abc123', reference: 'pi_abc', status: 'failed' },
    });

    await service.dispatch(body, 'sig', '123');

    expect(payrollPayoutService.processBachsPayload).toHaveBeenCalled();
    expect(subscriptionBillingService.processBachsPayload).not.toHaveBeenCalled();
  });

  it('falls through to subscription billing for non-wallet events', async () => {
    const body = JSON.stringify({
      type: 'invoice.paid',
      data: { metadata: { billingType: 'subscription' } },
    });

    await service.dispatch(body, 'sig', '123');

    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
    expect(payrollPayoutService.processBachsPayload).not.toHaveBeenCalled();
    expect(subscriptionBillingService.processBachsPayload).toHaveBeenCalled();
  });
});
