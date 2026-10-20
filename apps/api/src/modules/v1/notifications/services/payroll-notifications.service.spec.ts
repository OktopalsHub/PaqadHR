import { PayrollNotificationsService } from './payroll-notifications.service';

describe('PayrollNotificationsService', () => {
  const build = (organizationName: string | null) => {
    const createNotification = jest.fn().mockResolvedValue(undefined);
    const service = new PayrollNotificationsService(
      { createNotification } as never,
      { resolve: jest.fn().mockResolvedValue(organizationName) } as never,
    );
    return { service, createNotification };
  };

  it('names the organization that paid the salary', async () => {
    const { service, createNotification } = build('Acme Holdings');

    await service.sendPayrollNotification('member-1', 'tenant-1', {
      employeeName: 'Ada Lovelace',
      payrollPeriod: 'March 2026',
      amount: 250_000,
      currency: 'NGN',
    });

    const payload = createNotification.mock.calls[0][0];
    expect(payload.message).toContain('from Acme Holdings');
    expect(payload.metadata).toMatchObject({ organizationName: 'Acme Holdings' });
  });

  it('names the organization on the payslip notice', async () => {
    const { service, createNotification } = build('Acme Holdings');

    await service.sendPayslipPublishedNotification('member-1', 'tenant-1', {
      employeeName: 'Ada Lovelace',
      payrollPeriod: 'March 2026',
    });

    const payload = createNotification.mock.calls[0][0];
    expect(payload.message).toContain('from Acme Holdings');
    expect(payload.message).toContain('sent to your email');
    expect(payload.channel).toBe('in_app');
    expect(payload.metadata).toMatchObject({ organizationName: 'Acme Holdings' });
  });

  it('omits the organization when the workspace name is unknown', async () => {
    const { service, createNotification } = build(null);

    await service.sendPayrollNotification('member-1', 'tenant-1', {
      employeeName: 'Ada Lovelace',
      payrollPeriod: 'March 2026',
      amount: 250_000,
      currency: 'NGN',
    });

    const payload = createNotification.mock.calls[0][0];
    expect(payload.message).not.toContain('from ');
    expect(payload.metadata).not.toHaveProperty('organizationName');
  });
});
