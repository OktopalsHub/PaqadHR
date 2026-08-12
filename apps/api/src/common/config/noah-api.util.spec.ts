import {
  formatNoahHttpError,
  isNoahOperationSuccessful,
  isNoahPaymentVerified,
  normalizeNoahWebhookPayload,
} from './noah-api.util';

describe('noah-api.util', () => {
  it('maps Noah 401 to an auth configuration message', () => {
    const message = formatNoahHttpError(401, 'Noah request failed (401)');
    expect(message).toContain('authentication failed');
    expect(message).toContain('NOAH_API_KEY');
    expect(message).not.toContain('Noah Error:');
  });

  it('maps Noah 401 signature errors to signing setup guidance', () => {
    const message = formatNoahHttpError(401, 'signature not provided');
    expect(message).toContain('NOAH_SIGNING_PRIVATE_KEY');
    expect(message).not.toContain('Noah Error:');
  });

  it('keeps non-auth Noah failures prefixed', () => {
    expect(formatNoahHttpError(400, 'invalid currency')).toBe('Noah Error: invalid currency');
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
