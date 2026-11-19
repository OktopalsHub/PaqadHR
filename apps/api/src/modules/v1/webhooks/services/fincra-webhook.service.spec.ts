import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';

import { TenantWalletTopupService } from '../../rewards/services/tenant-wallet-topup.service';
import { FincraWebhookService } from './fincra-webhook.service';

jest.mock('src/common/config/fincra-webhook.util', () => ({
  verifyFincraWebhookSignature: jest.fn(),
  extractFincraWalletTopupCheckout: jest.fn(),
}));

import {
  extractFincraWalletTopupCheckout,
  verifyFincraWebhookSignature,
} from 'src/common/config/fincra-webhook.util';

describe('FincraWebhookService', () => {
  let service: FincraWebhookService;
  let walletTopupService: jest.Mocked<Pick<TenantWalletTopupService, 'completeCheckoutTopup'>>;

  beforeEach(() => {
    walletTopupService = {
      completeCheckoutTopup: jest.fn().mockResolvedValue({ received: true, credited: true }),
    };

    service = new FincraWebhookService(walletTopupService as unknown as TenantWalletTopupService);
    (verifyFincraWebhookSignature as jest.Mock).mockReturnValue(true);
    (extractFincraWalletTopupCheckout as jest.Mock).mockReturnValue(null);
  });

  it('rejects missing signature', async () => {
    await expect(service.dispatch('{}', '')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid signature', async () => {
    (verifyFincraWebhookSignature as jest.Mock).mockReturnValue(false);
    await expect(service.dispatch('{}', 'bad')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid JSON', async () => {
    await expect(service.dispatch('{bad', 'sig')).rejects.toThrow(BadRequestException);
  });

  it('routes wallet top-up checkout to wallet credit', async () => {
    (extractFincraWalletTopupCheckout as jest.Mock).mockReturnValue({
      tenantId: 't1',
      orderReference: 'wf_abc',
      amount: 2500,
    });

    await service.dispatch(JSON.stringify({ event: 'charge.successful' }), 'sig');

    expect(walletTopupService.completeCheckoutTopup).toHaveBeenCalledWith(
      {
        tenantId: 't1',
        orderReference: 'wf_abc',
        amount: 2500,
      },
      PaymentProvider.FINCRA,
    );
  });

  it('returns 503 when wallet verify is still pending', async () => {
    (extractFincraWalletTopupCheckout as jest.Mock).mockReturnValue({
      tenantId: 't1',
      orderReference: 'wf_abc',
    });
    walletTopupService.completeCheckoutTopup.mockResolvedValue({
      received: true,
      credited: false,
      retryable: true,
    });

    await expect(service.dispatch('{}', 'sig')).rejects.toThrow(ServiceUnavailableException);
  });
});
