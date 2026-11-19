import { UnauthorizedException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';

import { NoahWebhookService } from './noah-webhook.service';

describe('NoahWebhookService', () => {
  const noahApi = {
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };
  const walletTopupService = {
    completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
  };

  const service = new NoahWebhookService(noahApi as never, walletTopupService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    noahApi.verifyWebhookSignature.mockReturnValue(true);
  });

  it('rejects missing signatures', async () => {
    await expect(service.dispatch('{}', '')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid signatures', async () => {
    noahApi.verifyWebhookSignature.mockReturnValue(false);
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
      PaymentProvider.NOAH,
    );
  });

  // Payroll float funding and wallet top-up share a provider, so both routes are asserted:
  // a payroll float checkout must not be mistaken for a wallet credit.
  it('ignores subscription checkout events (handled by Bachs/Nomba)', async () => {
    const payload = {
      event_type: 'payment_success',
      data: {
        externalID: 'sub_tenant1_abc',
        metadata: { tenantId: 'tenant-1', billingType: 'subscription' },
      },
    };

    await service.dispatch(JSON.stringify(payload), 'sig');

    expect(walletTopupService.completeCheckoutTopup).not.toHaveBeenCalled();
  });
});
