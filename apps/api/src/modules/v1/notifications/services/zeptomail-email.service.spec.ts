import {
  buildZeptomailPayload,
  formatZeptomailError,
  formatZeptomailSdkError,
  normalizeZeptomailToken,
} from './zeptomail-email.service';

describe('zeptomail helpers', () => {
  it('normalizes bare api keys to Zeptomail auth tokens', () => {
    expect(normalizeZeptomailToken('abc123')).toBe('Zoho-enczapikey abc123');
    expect(normalizeZeptomailToken('Zoho-enczapikey abc123')).toBe('Zoho-enczapikey abc123');
    expect(normalizeZeptomailToken('zoho-enczapikey abc123')).toBe('Zoho-enczapikey abc123');
  });

  it('sends htmlbody and textbody when both are present', () => {
    const payload = buildZeptomailPayload(
      {
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        text: 'Hi',
      },
      'noreply@paqadhr.com',
    );

    expect(payload.htmlbody).toBe('<p>Hi</p>');
    expect(payload.textbody).toBe('Hi');
  });

  it('falls back to textbody when html is missing', () => {
    const payload = buildZeptomailPayload(
      {
        to: 'user@example.com',
        subject: 'Hello',
        text: 'Hi',
      },
      'noreply@paqadhr.com',
    );

    expect(payload.textbody).toBe('Hi');
    expect(payload.htmlbody).toBeUndefined();
  });

  it('formats nested Zeptomail error details', () => {
    const message = formatZeptomailError(500, {
      error: {
        code: 'TM_5001',
        message: 'Credit exhausted',
        request_id: 'req-123',
        details: [{ message: 'Sender address domain is not verified', target: 'from' }],
      },
    });

    expect(message).toContain('TM_5001');
    expect(message).toContain('Credit exhausted');
    expect(message).toContain('request_id: req-123');
  });

  it('formats SDK rejection payloads', () => {
    const message = formatZeptomailSdkError({
      error: { code: 'TM_4001', message: 'Sender address domain is not verified in your Agent.' },
    });

    expect(message).toContain('TM_4001');
    expect(message).toContain('Sender address domain is not verified');
  });

  it('formats standard Error instances without Zeptomail body shape', () => {
    expect(formatZeptomailSdkError(new Error('network timeout'))).toBe('network timeout');
  });
});
