import { sanitizeSentryEvent } from './sanitize-sentry-event';

describe('sanitizeSentryEvent', () => {
  it('removes request and user data while retaining a safe error signal', () => {
    const event = sanitizeSentryEvent({
      user: { email: 'person@example.com' },
      extra: { salary: 500000 },
      breadcrumbs: [{ message: 'person@example.com opened payroll' }],
      request: {
        url: 'https://api.paqadhr.com/api/v1/users?email=person@example.com',
        headers: { authorization: 'Bearer secret' },
        cookies: 'session=secret',
        data: { password: 'secret' },
      },
      exception: { values: [{ value: 'Failed for person@example.com with Bearer token-value' }] },
    });

    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.breadcrumbs).toEqual([]);
    expect(event.request).toEqual({ url: '/api/v1/users' });
    expect(event.exception?.values?.[0]?.value).toBe(
      'Failed for [redacted-email] with Bearer [redacted-token]',
    );
  });
});
