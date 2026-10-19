import { renderPayrollNotificationEmail } from './payroll-notification.template';

describe('renderPayrollNotificationEmail', () => {
  const baseVars = {
    employeeName: 'Ada Lovelace',
    payrollPeriod: 'March 2026',
    amount: 250_000,
    currency: 'NGN',
  };

  it('names the organization that paid the salary', () => {
    const result = renderPayrollNotificationEmail({
      ...baseVars,
      organizationName: 'Acme Holdings',
    });

    expect(result.html).toContain('Acme Holdings');
    expect(result.text).toContain('Acme Holdings');
    expect(result.html).not.toContain('The Paqad Team');
  });

  it('falls back to the Paqad team when the payer is unknown', () => {
    const result = renderPayrollNotificationEmail(baseVars);

    expect(result.html).toContain('The Paqad Team');
    expect(result.text).toContain('The Paqad Team');
  });

  it('escapes the organization name', () => {
    const result = renderPayrollNotificationEmail({
      ...baseVars,
      organizationName: '<img src=x onerror=alert(1)>',
    });

    expect(result.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(result.html).toContain('&lt;img');
  });
});
