import {
  buildZeptomailPayload,
  formatZeptomailError,
  formatZeptomailSdkError,
  toUserFacingEmailError,
} from './zeptomail-email.service';

describe('zeptomail helpers', () => {
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

  it('maps technical Zeptomail errors to user-facing messages', () => {
    expect(
      toUserFacingEmailError(
        'Zeptomail API error (500) [TM_5001]: Unknown error (request_id: req-123)',
      ),
    ).toBe(
      'We could not send the invite email. Try resend from Invitations, or contact support if it keeps failing.',
    );

    expect(
      toUserFacingEmailError(
        'Zeptomail API error (400) [TM_4001]: Sender address domain is not verified in your Agent.',
      ),
    ).toBe(
      'The sender email is not verified for delivery. Your admin needs to verify it in Zeptomail.',
    );
  });
});
