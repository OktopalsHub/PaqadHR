import { IntegrationType } from 'src/common/enums';
import { OAuthIntegrationService } from './oauth-integration.service';

describe('OAuthIntegrationService.generateOAuthUrl', () => {
  const service = new OAuthIntegrationService({} as any);

  it('requests groups:read for Slack private channel listing', () => {
    const url = service.generateOAuthUrl(
      'tenant-1',
      IntegrationType.SLACK,
      'member-1',
      'https://app.example.com/integrations/oauth/callback',
    );

    expect(url).toContain('groups:read');
    expect(url).toContain('channels:read');
  });
});
