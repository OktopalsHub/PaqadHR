import { NotFoundException } from '@nestjs/common';
import { OAuthIntegrationController } from './integration-oauth.controller';

describe('OAuthIntegrationController channels', () => {
  const tenantId = 'tenant-1';
  const integrationId = 'integration-1';
  const member = { id: 'member-1', role: 'admin' as const };

  let controller: OAuthIntegrationController;
  let integrationService: {
    requireTenantIntegration: jest.Mock;
    syncUsers: jest.Mock;
  };
  let oauthService: { getUserToken: jest.Mock };
  let channelService: {
    getAvailableChannels: jest.Mock;
    createSlackChannel: jest.Mock;
    configureShoutoutChannel: jest.Mock;
  };

  beforeEach(() => {
    integrationService = {
      requireTenantIntegration: jest.fn().mockResolvedValue({ id: integrationId, tenantId }),
      syncUsers: jest.fn().mockResolvedValue(undefined),
    };
    oauthService = {
      getUserToken: jest.fn().mockResolvedValue({ userAccessToken: 'user-token' }),
    };
    channelService = {
      getAvailableChannels: jest.fn().mockResolvedValue([{ id: 'C1', name: 'general' }]),
      createSlackChannel: jest.fn().mockResolvedValue({ id: 'C2', name: 'shoutouts' }),
      configureShoutoutChannel: jest.fn().mockResolvedValue({ testMessageSent: true }),
    };

    controller = new OAuthIntegrationController(
      oauthService as any,
      channelService as any,
      {} as any,
      integrationService as any,
    );
  });

  it('lists channels for a tenant-owned integration', async () => {
    const result = await controller.getAvailableChannels(tenantId, integrationId);

    expect(integrationService.requireTenantIntegration).toHaveBeenCalledWith(
      tenantId,
      integrationId,
    );
    expect(channelService.getAvailableChannels).toHaveBeenCalledWith(integrationId);
    expect(result).toEqual([{ id: 'C1', name: 'general' }]);
  });

  it('returns 404 when integration does not belong to tenant', async () => {
    integrationService.requireTenantIntegration.mockRejectedValue(
      new NotFoundException('Integration not found'),
    );

    await expect(controller.getAvailableChannels(tenantId, integrationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a channel for a tenant-owned integration', async () => {
    const result = await controller.createChannel(tenantId, integrationId, { name: 'shoutouts' });

    expect(channelService.createSlackChannel).toHaveBeenCalledWith(integrationId, 'shoutouts');
    expect(result).toEqual({ id: 'C2', name: 'shoutouts' });
  });

  it('sets up shoutout channel for a tenant-owned integration', async () => {
    const result = await controller.setupChannel(
      tenantId,
      integrationId,
      { platformChannelId: 'C1', platformChannelName: '#general' },
      { member } as any,
    );

    expect(channelService.configureShoutoutChannel).toHaveBeenCalledWith(
      integrationId,
      'C1',
      '#general',
      member.id,
      'user-token',
    );
    expect(integrationService.syncUsers).toHaveBeenCalledWith(integrationId, 'C1');
    expect(result.success).toBe(true);
  });
});
