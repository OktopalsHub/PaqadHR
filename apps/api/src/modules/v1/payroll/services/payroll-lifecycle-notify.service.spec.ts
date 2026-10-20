import type { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollLifecycleNotifyService } from './payroll-lifecycle-notify.service';

describe('PayrollLifecycleNotifyService payslip delivery', () => {
  const run = {
    id: 'run-1',
    title: 'September payroll',
    tenantId: 'tenant-1',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    baseCurrency: 'NGN',
  };

  const item = {
    id: 'item-1',
    memberId: 'member-1',
    employee: { firstName: 'Ada', lastName: 'Lovelace' },
    paymentAmount: 250_000,
    paymentCurrency: 'NGN',
    netAmount: 250_000,
  } as unknown as PayrollItem;

  const build = () => {
    const getTenantMember = jest.fn().mockResolvedValue({ user: { email: 'ada@example.com' } });
    const renderPayslipPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4'));
    const sendEmail = jest.fn().mockResolvedValue({ success: true });
    const service = new PayrollLifecycleNotifyService(
      {} as never,
      { getTenantMember } as never,
      undefined,
      { renderPayslipPdf } as never,
      { sendEmail } as never,
    );
    return { service, getTenantMember, renderPayslipPdf, sendEmail };
  };

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('emails the payslip PDF off the request path', async () => {
    const { service, renderPayslipPdf, sendEmail } = build();

    await service.onPayslipsPublished({
      tenantId: 'tenant-1',
      run,
      items: [item],
      sendEmail: true,
    });
    await flush();

    expect(renderPayslipPdf).toHaveBeenCalledWith(run, item);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: expect.stringContaining('Your payslip for'),
        attachments: [
          expect.objectContaining({
            filename: expect.stringMatching(/^payslip-.*\.pdf$/),
            content: Buffer.from('%PDF-1.4'),
            contentType: 'application/pdf',
          }),
        ],
      }),
    );
  });

  it('skips email when publication does not request it', async () => {
    const { service, getTenantMember, sendEmail } = build();

    await service.onPayslipsPublished({
      tenantId: 'tenant-1',
      run,
      items: [item],
      sendEmail: false,
    });
    await flush();

    expect(getTenantMember).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not fail the publish when the mail provider rejects', async () => {
    const { service, sendEmail } = build();
    sendEmail.mockResolvedValue({ success: false, error: 'mail down' });

    await expect(
      service.onPayslipsPublished({
        tenantId: 'tenant-1',
        run,
        items: [item],
        sendEmail: true,
      }),
    ).resolves.toBeUndefined();
    await flush();
  });
});
