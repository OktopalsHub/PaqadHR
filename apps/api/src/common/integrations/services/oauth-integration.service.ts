import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ENVIRONMENT } from 'src/common/config/env.config';
import { IntegrationType } from 'src/common/enums';
import { EntityManager } from 'typeorm';
import { PlatformIntegration } from '../entities/platform-integration.entity';
import { UserIntegrationToken } from '../entities/user-integration-token.entity';
import type { OAuthTokenData } from '../integration.types';

@Injectable()
export class OAuthIntegrationService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}
  generateOAuthUrl(
    tenantId: string,
    platformType: IntegrationType,
    tenantMemberId: string,
    redirectUri: string,
  ): string {
    const state = Buffer.from(
      JSON.stringify({
        tenantId,
        tenantMemberId,
        platformType,
        timestamp: Date.now(),
      }),
    ).toString('base64');
    switch (platformType) {
      case IntegrationType.SLACK:
        return (
          `https://slack.com/oauth/v2/authorize?` +
          `client_id=${ENVIRONMENT.SLACK.CLIENT_ID}&` +
          `scope=chat:write,channels:read,channels:join,channels:manage,users:read&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `state=${state}`
        );
      case IntegrationType.GOOGLE_CHAT:
        return (
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${ENVIRONMENT.GOOGLE.CLIENT_ID}&` +
          `response_type=code&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=https://www.googleapis.com/auth/chat.messages&` +
          `state=${state}`
        );
      default:
        throw new BadRequestException(`Unsupported platform: ${platformType}`);
    }
  }
  async handleOAuthCallback(code: string, state: string) {
    return this.entityManager.transaction(async (manager) => {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { tenantId, tenantMemberId, platformType } = stateData;
      const redirectUri = `${ENVIRONMENT.APP.BASE_URL}/integrations/oauth/callback`;
      const tokenData = await this.exchangeCodeForTokens(platformType, code, redirectUri);
      let integration = await manager.findOne(PlatformIntegration, {
        where: { tenantId, type: platformType },
      });
      if (!integration) {
        integration = await this.createInitialIntegration(
          manager,
          tenantId,
          platformType,
          tokenData,
        );
      }
      if (!tokenData.access_token) {
        throw new BadRequestException(
          'OAuth did not return an access token. Reconnect the integration and try again.',
        );
      }
      const platformUserId = tokenData.user_id || tokenData.username;
      if (!platformUserId) {
        throw new BadRequestException(
          'OAuth did not return a platform user id. Reconnect the integration and try again.',
        );
      }

      const existingUserToken = await manager.findOne(UserIntegrationToken, {
        where: {
          tenantMemberId,
          integrationId: integration.id,
          platformUserId,
        },
      });
      let userToken: UserIntegrationToken;
      if (existingUserToken) {
        await manager.update(UserIntegrationToken, existingUserToken.id, {
          platformUsername: tokenData.username,
          scopes: tokenData.scope?.split(',') || [],
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : undefined,
          userAccessToken: tokenData.access_token,
          userRefreshToken: tokenData.refresh_token,
        });
        userToken = existingUserToken;
      } else {
        userToken = manager.create(UserIntegrationToken, {
          tenantMemberId,
          integrationId: integration.id,
          platformType,
          userAccessToken: tokenData.access_token,
          userRefreshToken: tokenData.refresh_token,
          platformUserId,
          platformUsername: tokenData.username,
          scopes: tokenData.scope?.split(',') || [],
          expiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : undefined,
        });
        await manager.save(userToken);
      }
      if (tokenData.bot_token || tokenData.botToken) {
        await manager.update(PlatformIntegration, integration.id, {
          botToken: tokenData.bot_token || tokenData.botToken,
        });
      }
      const userTokenId = userToken.id;
      return {
        id: userTokenId,
        integrationId: integration.id,
      };
    });
  }
  private async exchangeCodeForTokens(
    platformType: IntegrationType,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokenData> {
    switch (platformType) {
      case IntegrationType.SLACK:
        return this.exchangeSlackToken(code, redirectUri);
      case IntegrationType.GOOGLE_CHAT:
        return this.exchangeGoogleToken(code, redirectUri);
      default:
        throw new BadRequestException(`Unsupported platform: ${platformType}`);
    }
  }
  private async exchangeSlackToken(code: string, redirectUri: string): Promise<OAuthTokenData> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ENVIRONMENT.SLACK.CLIENT_ID,
        client_secret: ENVIRONMENT.SLACK.CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      throw new BadRequestException(`Slack OAuth error: ${data.error}`);
    }

    // Bot installs expose workspace token on `access_token`; user token is optional under `authed_user`.
    const userAccessToken = data.authed_user?.access_token ?? data.access_token;
    if (!userAccessToken) {
      throw new BadRequestException(
        'Slack OAuth did not return an access token. Check app scopes and try connecting again.',
      );
    }

    return {
      access_token: userAccessToken,
      refresh_token: data.authed_user?.refresh_token,
      user_id: data.authed_user?.id ?? data.bot_user_id ?? data.team?.id,
      username: data.authed_user?.id ?? data.bot_user_id ?? data.team?.name,
      scope: data.authed_user?.scope ?? data.scope,
      expires_in: data.authed_user?.expires_in,
      team_id: data.team?.id,
      team_name: data.team?.name,
      bot_token: data.access_token ?? data.bot?.token,
    };
  }
  private async exchangeGoogleToken(code: string, redirectUri: string): Promise<OAuthTokenData> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ENVIRONMENT.GOOGLE.CLIENT_ID,
        client_secret: ENVIRONMENT.GOOGLE.CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new BadRequestException(`Google OAuth error: ${data.error_description}`);
    }
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: userData.id,
      username: userData.email,
      scope: data.scope,
      expires_in: data.expires_in,
    };
  }
  async getUserToken(
    integrationId: string,
    tenantMemberId: string,
  ): Promise<UserIntegrationToken | null> {
    return this.entityManager.findOne(UserIntegrationToken, {
      where: {
        integrationId,
        tenantMemberId,
        isActive: true,
      },
    });
  }
  private async createInitialIntegration(
    manager: EntityManager,
    tenantId: string,
    platformType: IntegrationType,
    tokenData: OAuthTokenData,
  ): Promise<PlatformIntegration> {
    const integrationData = {
      tenantId,
      type: platformType,
      platformTeamId: tokenData.team_id || 'user-integration',
      platformTeamName: tokenData.team_name || `${platformType} Integration`,
      botToken: tokenData.bot_token ?? '',
      isActive: true,
    };
    const integration = manager.create(PlatformIntegration, integrationData);
    return manager.save(integration);
  }
}
