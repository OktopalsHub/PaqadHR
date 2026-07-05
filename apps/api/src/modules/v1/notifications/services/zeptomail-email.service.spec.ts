import { buildZeptomailPayload, formatZeptomailError } from './zeptomail-email.service';

describe('zeptomail helpers', () => {
  it('sends htmlbody only when html is present', () => {
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
    expect(payload.textbody).toBeUndefined();
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
});
