import { EmailTemplateService } from './email-template.service';
import { ZeptomailEmailService } from './zeptomail-email.service';

describe('ZeptomailEmailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ZEPTOMAIL_API_KEY;
  });

  it('treats empty 2xx response body as success', async () => {
    process.env.ZEPTOMAIL_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const service = new ZeptomailEmailService(new EmailTemplateService());
    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(result.success).toBe(true);
  });

  it('treats whitespace-only 2xx body as success', async () => {
    process.env.ZEPTOMAIL_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '   \n',
    });

    const service = new ZeptomailEmailService(new EmailTemplateService());
    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      text: 'Hi',
    });

    expect(result.success).toBe(true);
  });
});
