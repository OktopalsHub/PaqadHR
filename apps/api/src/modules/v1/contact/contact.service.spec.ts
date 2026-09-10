import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.WEB3FORMS_ACCESS_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.WEB3FORMS_ACCESS_KEY;
    } else {
      process.env.WEB3FORMS_ACCESS_KEY = originalKey;
    }
  });

  it('rejects when WEB3FORMS_ACCESS_KEY is missing', async () => {
    delete process.env.WEB3FORMS_ACCESS_KEY;
    const service = new ContactService();
    await expect(
      service.submit({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('submits to Web3Forms when configured', async () => {
    process.env.WEB3FORMS_ACCESS_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    const service = new ContactService();
    await expect(
      service.submit({
        name: 'Ada',
        email: 'Ada@Example.com',
        message: 'Hello',
      }),
    ).resolves.toEqual({ success: true });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.web3forms.com/submit',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        body: JSON.stringify({
          access_key: 'test-key',
          name: 'Ada',
          email: 'ada@example.com',
          message: 'Hello',
          subject: 'Paqad contact form',
        }),
      }),
    );
  });

  it('maps provider failure to BadGatewayException', async () => {
    process.env.WEB3FORMS_ACCESS_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: 'fail' }),
    }) as unknown as typeof fetch;

    const service = new ContactService();
    await expect(
      service.submit({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
