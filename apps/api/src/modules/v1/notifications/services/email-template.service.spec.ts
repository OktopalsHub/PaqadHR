import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  const service = new EmailTemplateService();

  it('renders invitation template with Paqad branding and Daniel sign-off', () => {
    const rendered = service.render('invitation', {
      tenantName: 'Acme Corp',
      inviterName: 'Jane Doe',
      inviteLink: 'https://app.paqadhr.com/accept-invite?token=abc&email=new%40acme.com',
      firstName: 'Sam',
    });

    expect(rendered.subject).toBe("You're invited to join Acme Corp");
    expect(rendered.html).toContain('https://paqadhr.com/logo-lockup-light.png');
    expect(rendered.html).toContain('#00a070');
    expect(rendered.html).toContain('Daniel');
    expect(rendered.text).toContain('Sam');
  });

  it('renders product welcome email with getting-started sections', () => {
    const rendered = service.render('welcome', {
      firstName: 'Ada',
      setupUrl: 'https://paqadhr.com/onboarding',
      trialUrl: 'https://paqadhr.com/onboarding',
      docsUrl: 'https://paqadhr.com/onboarding',
    });

    expect(rendered.subject).toBe('Welcome to PaqadHR, Ada!');
    expect(rendered.html).toContain('Your friends at PaqadHR');
    expect(rendered.html).toContain('Set up your workspace');
    expect(rendered.html).toContain('Start 14-day free trial');
    expect(rendered.text).toContain('P.S.');
  });

  it('renders founder welcome email from Daniel', () => {
    const rendered = service.render('founder-welcome', {
      firstName: 'Ada',
      email: 'ada@example.com',
    });

    expect(rendered.subject).toContain('Daniel');
    expect(rendered.html).toContain('founder of PaqadHR');
    expect(rendered.html).toContain('crypto');
    expect(rendered.text).toContain('daniel@paqadhr.com');
  });

  it('renders password-reset template with branded layout', () => {
    const rendered = service.render('password-reset', {
      resetLink: 'https://paqadhr.com/reset-password?token=abc',
    });

    expect(rendered.subject).toBe('Reset your PaqadHR password');
    expect(rendered.html).toContain('logo-lockup-light.png');
    expect(rendered.html).toContain('Daniel');
  });

  it('throws for unknown template keys', () => {
    expect(() => service.render('missing', {})).toThrow("Template 'missing' not found");
  });
});
