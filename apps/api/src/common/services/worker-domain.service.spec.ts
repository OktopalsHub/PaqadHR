import { WorkerDomainService } from './worker-domain.service';

const MANAGED_KEYS = [
  'CF_WORKER_DOMAIN_API_TOKEN',
  'CF_WORKER_DOMAIN_ZONE_ID',
  'CF_WORKER_DOMAIN_WORKER_NAME',
  'CF_WORKER_DOMAIN_ACCOUNT_ID',
  'CF_WORKER_DOMAIN_SUFFIX',
  'CF_WORKER_DOMAIN_ENABLED',
  'APP_DOMAIN',
  'R2_ACCOUNT_ID',
] as const;

function cloudflareResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 403,
    json: async () => body,
  } as Response;
}

function listBody(hostnames: string[]): unknown {
  return {
    success: true,
    result: hostnames.map((hostname, index) => ({ id: `id-${index}`, hostname })),
    result_info: { page: 1, total_pages: 1 },
  };
}

describe('WorkerDomainService', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of MANAGED_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of MANAGED_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
    jest.restoreAllMocks();
  });

  function enable(): void {
    process.env.CF_WORKER_DOMAIN_API_TOKEN = 'token';
    process.env.CF_WORKER_DOMAIN_ZONE_ID = 'zone-id';
    process.env.CF_WORKER_DOMAIN_WORKER_NAME = 'paqadhr';
    process.env.CF_WORKER_DOMAIN_ACCOUNT_ID = 'account-id';
    process.env.CF_WORKER_DOMAIN_SUFFIX = 'paqadhr.com';
  }

  it('skips provisioning when it is not configured', async () => {
    const service = new WorkerDomainService();

    expect(service.isEnabled()).toBe(false);
    await expect(service.ensure('acme')).resolves.toBe('disabled');
    await expect(service.remove('acme')).resolves.toBe('disabled');
  });

  it('builds the tenant hostname from the slug', () => {
    enable();
    const service = new WorkerDomainService();

    expect(service.hostnameFor('acme')).toBe('acme.paqadhr.com');
    expect(service.hostnameFor(' Acme-Corp ')).toBe('acme-corp.paqadhr.com');
    expect(service.hostnameFor('acme.corp')).toBeNull();
    expect(service.hostnameFor('')).toBeNull();
  });

  it('attaches a missing hostname to the worker', async () => {
    enable();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(cloudflareResponse(listBody([])))
      .mockResolvedValueOnce(cloudflareResponse({ success: true, result: { id: 'new-id' } }));
    const service = new WorkerDomainService();

    await expect(service.ensure('acme')).resolves.toBe('created');

    const [listUrl] = fetchSpy.mock.calls[0] as [string];
    expect(listUrl).toContain('/accounts/account-id/workers/domains');
    expect(listUrl).toContain('zone_id=zone-id');

    const [attachUrl, attachInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(attachUrl).toContain('/accounts/account-id/workers/domains');
    expect(attachInit.method).toBe('PUT');
    expect(JSON.parse(attachInit.body as string)).toEqual({
      zone_id: 'zone-id',
      hostname: 'acme.paqadhr.com',
      service: 'paqadhr',
      environment: 'production',
    });
  });

  it('does not re-attach a hostname that is already present', async () => {
    enable();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(cloudflareResponse(listBody(['acme.paqadhr.com'])));
    const service = new WorkerDomainService();

    await expect(service.ensure('acme')).resolves.toBe('present');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('reports a failure instead of throwing when Cloudflare rejects the attach', async () => {
    enable();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(cloudflareResponse(listBody([])))
      .mockResolvedValueOnce(
        cloudflareResponse(
          { success: false, errors: [{ code: 10021, message: 'limit reached' }] },
          false,
        ),
      );
    const service = new WorkerDomainService();

    await expect(service.ensure('acme')).resolves.toBe('failed');
  });

  it('refuses to provision invalid slugs without calling Cloudflare', async () => {
    enable();
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new WorkerDomainService();

    await expect(service.ensure('not a slug')).resolves.toBe('failed');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('detaches a hostname that is attached', async () => {
    enable();
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        cloudflareResponse(listBody(['acme.paqadhr.com', 'other.paqadhr.com'])),
      )
      .mockResolvedValueOnce(cloudflareResponse({ success: true }));
    const service = new WorkerDomainService();

    await expect(service.remove('acme')).resolves.toBe('deleted');

    const [deleteUrl, deleteInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(deleteUrl).toContain('/accounts/account-id/workers/domains/id-0');
    expect(deleteInit.method).toBe('DELETE');
  });

  it('treats a missing hostname as already detached', async () => {
    enable();
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(cloudflareResponse(listBody([])));
    const service = new WorkerDomainService();

    await expect(service.remove('acme')).resolves.toBe('absent');
  });

  it('lists the attached hostnames', async () => {
    enable();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(cloudflareResponse(listBody(['acme.paqadhr.com', 'www.paqadhr.com'])));
    const service = new WorkerDomainService();

    await expect(service.listHostnames()).resolves.toEqual(['acme.paqadhr.com', 'www.paqadhr.com']);
  });
});
