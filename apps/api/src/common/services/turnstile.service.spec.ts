import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
    jest.restoreAllMocks();
  });

  it('skips verification when secret is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const service = new TurnstileService();

    expect(service.isEnabled()).toBe(false);
    await expect(service.verify('')).resolves.toBe(true);
  });

  it('rejects missing token when secret is set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const service = new TurnstileService();

    await expect(service.verify('')).resolves.toBe(false);
  });

  it('accepts successful siteverify response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const service = new TurnstileService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await expect(service.verify('valid-token', '127.0.0.1')).resolves.toBe(true);
  });

  it('rejects failed siteverify response', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const service = new TurnstileService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    } as Response);

    await expect(service.verify('bad-token')).resolves.toBe(false);
  });
});
