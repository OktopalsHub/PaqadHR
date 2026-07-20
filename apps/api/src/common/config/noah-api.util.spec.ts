import {
  isNoahOperationSuccessful,
  isNoahPaymentVerified,
  normalizeNoahWebhookPayload,
} from './noah-api.util';

describe('noah-api.util', () => {
  it('treats Settled as a successful operation status', () => {
    expect(isNoahOperationSuccessful('Settled')).toBe(true);
    expect(isNoahPaymentVerified('Settled')).toBe(true);
  });

  it('normalizes PascalCase Noah Transaction webhooks', () => {
    const normalized = normalizeNoahWebhookPayload({
      EventType: 'Transaction',
      EventVersion: 1764856385061,
      Data: {
        ID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
        Status: 'Settled',
        Reference: 'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
      },
    });

    expect(normalized.eventType).toBe('Transaction');
    expect(normalized.data).toMatchObject({
      status: 'Settled',
      externalID:
        'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
      transactionID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
    });
  });

  it('passes through already-normalized payloads', () => {
    const payload = {
      event_type: 'payment_success',
      data: { externalID: 'nw_abc', status: 'success' },
    };
    const normalized = normalizeNoahWebhookPayload(payload);
    expect(normalized.event_type).toBe('payment_success');
    expect(normalized.data).toMatchObject({ externalID: 'nw_abc', status: 'success' });
  });
});
