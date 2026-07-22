import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  const service = new EmailTemplateService();

  it('renders invitation template with Paqad branding', () => {
    const rendered = service.render('invitation', {
      tenantName: 'Acme Corp',
      inviterName: 'Jane Doe',
      inviteLink: 'https://app.paqadhr.com/accept-invite?token=abc&email=new%40acme.com',
      firstName: 'Sam',
    });

    expect(rendered.subject).toBe("You're invited to join Acme Corp");
    expect(rendered.html).toContain('https://paqadhr.com/logo-lockup-light.png');
    expect(rendered.html).toContain('#00a070');
    expect(rendered.html).toContain('Jane Doe');
    expect(rendered.html).not.toContain('founder of PaqadHR');
    expect(rendered.text).toContain('Sam');
    expect(rendered.text).not.toContain('founder of PaqadHR');
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
