import { EmailTemplateService } from './email-template.service';

describe('EmailTemplateService', () => {
  const service = new EmailTemplateService();

  it('renders invitation template with Paqad branding and variables', () => {
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
    expect(rendered.html).toContain('Acme Corp');
    expect(rendered.html).toContain('accept-invite?token=abc');
    expect(rendered.text).toContain('Sam');
    expect(rendered.text).toContain('Accept invitation');
  });

  it('throws for unknown template keys', () => {
    expect(() => service.render('missing', {})).toThrow("Template 'missing' not found");
  });
});
