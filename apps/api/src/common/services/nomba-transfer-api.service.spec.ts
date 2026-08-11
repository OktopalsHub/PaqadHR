import { NombaTransferApiService } from './nomba-transfer-api.service';

describe('NombaTransferApiService.parseTransferWebhook', () => {
  const service = new NombaTransferApiService();

  it('parses payout_success bank transfer events', () => {
    const event = service.parseTransferWebhook({
      event_type: 'payout_success',
      data: {
        id: 'API-TRANSFER-1',
        status: 'SUCCESS',
        meta: {
          merchantTxRef:
            'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
        },
      },
    });

    expect(event).toEqual({
      eventId: 'API-TRANSFER-1',
      reference: 'API-TRANSFER-1',
      merchantTxRef:
        'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
      status: 'SUCCESS',
    });
  });

  it('parses payout_failed events', () => {
    const event = service.parseTransferWebhook({
      event_type: 'payout_failed',
      data: {
        id: 'API-TRANSFER-2',
        status: 'FAILED',
        meta: {
          merchantTxRef:
            'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
        },
      },
    });

    expect(event?.status).toBe('FAILED');
    expect(event?.merchantTxRef).toContain('payroll_');
  });

  it('still accepts payment_success for compatibility', () => {
    const event = service.parseTransferWebhook({
      event_type: 'payment_success',
      data: { id: 'ref-1', status: 'SUCCESS' },
    });
    expect(event?.reference).toBe('ref-1');
  });

  it('ignores unrelated event types', () => {
    expect(
      service.parseTransferWebhook({ event_type: 'subscription.created', data: { id: 'x' } }),
    ).toBeNull();
  });
});
