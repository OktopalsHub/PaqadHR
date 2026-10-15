import {
  formatNoahHttpError,
  isNoahOperationSuccessful,
  isNoahPaymentVerified,
  normalizeNoahWebhookPayload,
} from './noah-api.util';

describe('noah-api.util', () => {
  it('maps Noah 401 to a generic checkout message', () => {
    const message = formatNoahHttpError(401, 'Noah request failed (401)');
    expect(message).toContain('temporarily unavailable');
    expect(message).not.toContain('Noah');
    expect(message).not.toContain('NOAH_');
  });

  it('maps Noah 401 signature errors without vendor details', () => {
    const message = formatNoahHttpError(401, 'signature not provided');
    expect(message).not.toContain('Noah');
    expect(message).not.toContain('NOAH_');
  });

  it('maps non-auth Noah failures generically', () => {
    expect(formatNoahHttpError(400, 'invalid currency')).toBe(
      'Checkout could not be completed. Please try again or contact support.',
    );
  });

  it('treats Settled as a successful operation status', () => {
    expect(isNoahOperationSuccessful('Settled')).toBe(true);
    expect(isNoahPaymentVerified('Settled')).toBe(true);
    expect(isNoahPaymentVerified('successful')).toBe(true);
  });

  it('normalizes PascalCase Noah Transaction webhooks', () => {
    const normalized = normalizeNoahWebhookPayload({
      EventType: 'Transaction',
      EventVersion: 1764856385061,
      Data: {
        ID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
        Status: 'Settled',
        Reference:
          'payroll_11111111-1111-4111-8111-111111111111_22222222-2222-4222-8222-222222222222',
      },
    });

    expect(normalized.EventType).toBe('Transaction');
    expect(normalized.eventType).toBe('Transaction');
    expect(normalized.Data).toMatchObject({
      Status: 'Settled',
      ID: '0ee0ed7a-57eb-5818-bd11-67cccd940e3e',
    });
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
