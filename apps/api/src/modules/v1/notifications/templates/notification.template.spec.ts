import { renderGenericNotificationEmail } from './notification.template';

describe('renderGenericNotificationEmail', () => {
  const baseVars = {
    title: 'Payroll Processed',
    message: 'Your payroll for March 2026 has been processed.',
  };

  it('signs off with the Paqad team when no organization is known', () => {
    const result = renderGenericNotificationEmail(baseVars);

    expect(result.html).toContain('The Paqad Team');
    expect(result.text).toContain('The Paqad Team');
  });

  it('signs off with the organization that sent the notification', () => {
    const result = renderGenericNotificationEmail({
      ...baseVars,
      organizationName: 'Acme Holdings',
    });

    expect(result.html).toContain('Acme Holdings');
    expect(result.html).not.toContain('The Paqad Team');
    expect(result.text).toContain('Acme Holdings');
    expect(result.text).not.toContain('The Paqad Team');
  });

  it('ignores a blank organization name', () => {
    const result = renderGenericNotificationEmail({ ...baseVars, organizationName: '   ' });

    expect(result.html).toContain('The Paqad Team');
  });

  it('escapes the organization name', () => {
    const result = renderGenericNotificationEmail({
      ...baseVars,
      organizationName: '<script>alert("xss")</script>',
    });

    expect(result.html).not.toContain('<script>alert("xss")</script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
});
