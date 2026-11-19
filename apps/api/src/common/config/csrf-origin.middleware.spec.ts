import type { Request, Response } from 'express';

import { csrfOriginMiddleware } from './csrf-origin.middleware';

describe('csrfOriginMiddleware', () => {
  const run = (req: Partial<Request>) => {
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) } as unknown as Response;
    const next = jest.fn();
    csrfOriginMiddleware(req as Request, res, next);
    return { next, res };
  };
  const cookieReq = (overrides: Partial<Request>): Partial<Request> => ({
    method: 'POST',
    path: '/api/v1/payroll/runs',
    headers: {},
    cookies: { access_token: 'jwt', dev_access_token: 'jwt' },
    ...overrides,
  });

  beforeEach(() => {
    process.env.TRUSTED_ORIGINS = 'https://app.example.com';
  });

  it('allows safe methods', () => {
    expect(run(cookieReq({ method: 'GET' })).next).toHaveBeenCalled();
  });

  it('allows cookie requests from a trusted origin', () => {
    const { next } = run(cookieReq({ headers: { origin: 'https://app.example.com' } }));
    expect(next).toHaveBeenCalled();
  });

  it('blocks cookie requests from an untrusted or missing origin', () => {
    expect(
      run(cookieReq({ headers: { origin: 'https://evil.example' } })).next,
    ).not.toHaveBeenCalled();
    expect(run(cookieReq({})).next).not.toHaveBeenCalled();
  });

  it('allows bearer-only requests and excluded paths', () => {
    expect(
      run({
        method: 'POST',
        path: '/api/v1/x',
        headers: { authorization: 'Bearer t' },
        cookies: {},
      }).next,
    ).toHaveBeenCalled();
    expect(run(cookieReq({ path: '/api/v1/payroll/webhooks/nomba' })).next).toHaveBeenCalled();
  });
});
