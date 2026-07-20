import { UnauthorizedException } from '@nestjs/common';
import { BillingProvider } from '../../subscriptions/constants/billing-provider.enum';
import { NoahWebhookService } from './noah-webhook.service';

describe('NoahWebhookService', () => {
  const subscriptionBillingService = {
    verifyNoahWebhookSignature: jest.fn().mockReturnValue(true),
    processNoahPayload: jest.fn().mockResolvedValue({ received: true }),
  };
  const payrollPayoutService = {
    processNoahPayload: jest.fn().mockResolvedValue({ received: true, matched: false }),
  };
  const walletTopupService = {
    completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
  };

  const service = new NoahWebhookService(
    subscriptionBillingService as never,
    payrollPayoutService as never,
    walletTopupService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionBillingService.verifyNoahWebhookSignature.mockReturnValue(true);
  });

  it('rejects missing signatures', async () => {
    await expect(service.dispatch('{}', '')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid signatures', async () => {
    subscriptionBillingService.verifyNoahWebhookSignature.mockReturnValue(false);
    await expect(service.dispatch('{}', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('routes wallet top-up checkout to wallet service', async () => {
    const payload = {
      event_type: 'payment_success',
      data: {
        externalID: 'nw_abc123',
        metadata: {
          tenantId: 'tenant-1',
          billingType: 'wallet_topup',
          expectedAmount: 100,
        },
      },
    };

    await service.dispatch(JSON.stringify(payload), 'sig');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
      BillingProvider.NOAH,
    );
  });

  it('routes subscription events to billing service', async () => {
    const payload = {
      event_type: 'payment_success',
      data: {
        externalID: 'sub_tenant1_abc',
        metadata: { tenantId: 'tenant-1', billingType: 'subscription' },
      },
    };

    await service.dispatch(JSON.stringify(payload), 'sig');

    expect(subscriptionBillingService.processNoahPayload).toHaveBeenCalled();
  });

  it('routes payroll webhooks before subscription checkout heuristic', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const itemId = '22222222-2222-4222-8222-222222222222';
    const payload = {
      event_type: 'transaction_settled',
      data: {
        externalID: `payroll_${runId}_${itemId}`,
        status: 'Settled',
      },
    };
    payrollPayoutService.processNoahPayload.mockResolvedValueOnce({ received: true, matched: true });

    await service.dispatch(JSON.stringify(payload), 'sig');

    expect(payrollPayoutService.processNoahPayload).toHaveBeenCalled();
    expect(subscriptionBillingService.processNoahPayload).not.toHaveBeenCalled();
  });

  it('routes PascalCase Transaction/Settled webhooks to payroll', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const itemId = '22222222-2222-4222-8222-222222222222';
    const payload = {
      EventType: 'Transaction',
      Data: {
        ID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
        Status: 'Settled',
        Reference: `payroll_${runId}_${itemId}`,
      },
    };
    payrollPayoutService.processNoahPayload.mockResolvedValueOnce({ received: true, matched: true });

    await service.dispatch(JSON.stringify(payload), 'sig');

    expect(payrollPayoutService.processNoahPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'Transaction',
        data: expect.objectContaining({
          status: 'Settled',
          externalID: `payroll_${runId}_${itemId}`,
          transactionID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
        }),
      }),
    );
    expect(subscriptionBillingService.processNoahPayload).not.toHaveBeenCalled();
  });
});
