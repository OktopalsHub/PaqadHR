import { getMonnifyBaseUrl, isAllowedMonnifyBaseUrl, isMonnifyLive } from './monnify.config';

describe('monnify.config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.MONNIFY_LIVE;
    delete process.env.MONNIFY_BASE_URL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('detects sandbox vs live base URL', () => {
    expect(getMonnifyBaseUrl()).toContain('sandbox.monnify.com');
    process.env.MONNIFY_LIVE = 'true';
    expect(getMonnifyBaseUrl()).toContain('api.monnify.com');
    expect(isMonnifyLive()).toBe(true);
  });

  it('restricts MONNIFY_BASE_URL overrides to HTTPS Monnify origins', () => {
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com')).toBe(true);
    expect(isAllowedMonnifyBaseUrl('https://sandbox.monnify.com')).toBe(true);
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com/')).toBe(true);
    expect(isAllowedMonnifyBaseUrl('http://api.monnify.com')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://evil.example.com')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com/custom')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com?x=1')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com#frag')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://user:pass@api.monnify.com')).toBe(false);
    expect(isAllowedMonnifyBaseUrl('https://api.monnify.com:8443')).toBe(false);

    process.env.MONNIFY_BASE_URL = 'http://api.monnify.com';
    expect(() => getMonnifyBaseUrl()).toThrow('MONNIFY_BASE_URL must use HTTPS');

    process.env.MONNIFY_BASE_URL = 'https://api.monnify.com/custom';
    expect(() => getMonnifyBaseUrl()).toThrow('MONNIFY_BASE_URL must use HTTPS');
  });
});
