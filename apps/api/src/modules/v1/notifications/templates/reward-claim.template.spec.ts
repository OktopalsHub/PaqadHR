import { renderRewardClaimEmail } from './reward-claim.template';

describe('renderRewardClaimEmail', () => {
  const baseVars = {
    employeeName: 'John Doe',
    employeeEmail: 'john@example.com',
    rewardName: 'Amazon Gift Card',
    rewardAmount: 50,
    currencyCode: 'USD',
    redemptionUrl: 'https://codes.rewardcodes.com/abc123',
    referenceId: 'redemption-uuid-123',
    providerName: 'Tremendous',
  };

  it('returns subject, html, and text', () => {
    const result = renderRewardClaimEmail(baseVars);
    expect(result.subject).toContain('Amazon Gift Card');
    expect(result.html).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('includes redemption URL in html and text', () => {
    const result = renderRewardClaimEmail(baseVars);
    expect(result.html).toContain('https://codes.rewardcodes.com/abc123');
    expect(result.text).toContain('https://codes.rewardcodes.com/abc123');
  });

  it('includes security code when provided', () => {
    const result = renderRewardClaimEmail({ ...baseVars, securityCode: 'RR678RQH' });
    expect(result.html).toContain('RR678RQH');
    expect(result.text).toContain('RR678RQH');
  });

  it('omits security code section when not provided', () => {
    const result = renderRewardClaimEmail(baseVars);
    expect(result.html).not.toContain('Security Code');
    expect(result.text).not.toContain('Security Code');
  });

  it('includes provider name', () => {
    const result = renderRewardClaimEmail(baseVars);
    expect(result.html).toContain('Tremendous');
    expect(result.text).toContain('Tremendous');
  });

  it('includes reference ID', () => {
    const result = renderRewardClaimEmail(baseVars);
    expect(result.html).toContain('redemption-uuid-123');
    expect(result.text).toContain('redemption-uuid-123');
  });

  it('escapes HTML in user-controlled fields', () => {
    const result = renderRewardClaimEmail({
      ...baseVars,
      rewardName: '<script>alert("xss")</script>',
      employeeName: '<img src=x onerror=alert(1)>',
    });
    expect(result.html).not.toContain('<script>alert("xss")</script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.text).toContain('<script>alert("xss")</script>');
  });

  it('rejects non-HTTPS redemption URLs', () => {
    const result = renderRewardClaimEmail({
      ...baseVars,
      redemptionUrl: 'javascript:alert(1)',
    });
    expect(result.html).toContain('invalid-redemption-url');
    expect(result.html).not.toContain('javascript:alert(1)');
  });

  it('rejects HTTP redemption URLs', () => {
    const result = renderRewardClaimEmail({
      ...baseVars,
      redemptionUrl: 'http://evil.com/phish',
    });
    expect(result.html).toContain('invalid-redemption-url');
    expect(result.html).not.toContain('http://evil.com/phish');
  });

  it('renders provider logo when URL is provided', () => {
    const result = renderRewardClaimEmail({
      ...baseVars,
      providerLogoUrl: 'https://example.com/logo.png',
    });
    expect(result.html).toContain('https://example.com/logo.png');
  });

  it('falls back to email prefix when employee name is missing', () => {
    const result = renderRewardClaimEmail({
      ...baseVars,
      employeeName: undefined,
    });
    expect(result.html).toContain('Hi john');
  });
});
