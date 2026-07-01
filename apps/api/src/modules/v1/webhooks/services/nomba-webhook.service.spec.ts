import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SubscriptionBillingService } from '../../subscriptions/services/subscription-billing.service';
import { PayrollPayoutService } from '../../payroll/services/payroll-payout.service';
import { RewardsService } from '../../rewards/services/rewards.service';
import { NombaWebhookService } from './nomba-webhook.service';

jest.mock('src/common/config/nomba-webhook.util', () => ({
  verifyNombaWebhookSignature: jest.fn(),
}));

import { verifyNombaWebhookSignature } from 'src/common/config/nomba-webhook.util';

describe('NombaWebhookService', () => {
  let service: NombaWebhookService;
  let subscriptionBilling: jest.Mocked<Pick<SubscriptionBillingService, 'processNombaPayload'>>;
  let payrollPayout: jest.Mocked<Pick<PayrollPayoutService, 'processNombaPayload'>>;
  let rewards: jest.Mocked<Pick<RewardsService, 'processNombaFundingPayload'>>;

  beforeEach(() => {
    subscriptionBilling = { processNombaPayload: jest.fn().mockResolvedValue({ received: true }) };
    payrollPayout = { processNombaPayload: jest.fn().mockResolvedValue({ received: true }) };
    rewards = {
      processNombaFundingPayload: jest.fn().mockResolvedValue({ received: true }),
    };

    service = new NombaWebhookService(
      subscriptionBilling as unknown as SubscriptionBillingService,
      payrollPayout as unknown as PayrollPayoutService,
      rewards as unknown as RewardsService,
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
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
    expect(rewards.processNombaFundingPayload).not.toHaveBeenCalled();
  });

  it('routes payroll merchant ref before wallet funding', async () => {
    const runId = '11111111-1111-4111-8111-111111111111';
    const itemId = '22222222-2222-4222-8222-222222222222';
    const body = JSON.stringify({
      event_type: 'transfer.success',
      data: { meta: { merchantTxRef: `payroll_${runId}_${itemId}` } },
    });

    await service.dispatch(body, 'sig');

    expect(payrollPayout.processNombaPayload).toHaveBeenCalled();
    expect(rewards.processNombaFundingPayload).not.toHaveBeenCalled();
  });

  it('routes deposit events to rewards funding', async () => {
    const body = JSON.stringify({
      event_type: 'deposit.success',
      data: { virtualAccount: '123', amount: 100, transactionReference: 'ref-1' },
    });

    await service.dispatch(body, 'sig');

    expect(rewards.processNombaFundingPayload).toHaveBeenCalled();
    expect(subscriptionBilling.processNombaPayload).not.toHaveBeenCalled();
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
  });

  it('returns received for unknown events', async () => {
    const result = await service.dispatch(JSON.stringify({ event_type: 'unknown.event' }), 'sig');

    expect(result).toEqual({ received: true });
    expect(subscriptionBilling.processNombaPayload).not.toHaveBeenCalled();
    expect(payrollPayout.processNombaPayload).not.toHaveBeenCalled();
    expect(rewards.processNombaFundingPayload).not.toHaveBeenCalled();
  });
});
