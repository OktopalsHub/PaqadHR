import { IntegrationType } from 'src/common/enums';

export interface PlatformUserData {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
}

export interface IntegrationConfig {
  teamId: string;
  teamName: string;
  accessToken: string;
  refreshToken?: string;
  botToken?: string;
  webhookUrl?: string;
  expiresAt?: Date;
}

export interface PlatformUserSaveData {
  integrationId: string;
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformEmail?: string;
  platformAvatarUrl?: string;
  tenantMemberId?: string;
}

export interface ShoutoutParticipant {
  tenantMemberId: string;
}

export interface ShoutoutBroadcast {
  creator: ShoutoutParticipant & {
    teamMemberships?: { teamId: string }[];
    departmentMemberships?: { departmentId: string }[];
  };
  recipients: Array<
    ShoutoutParticipant & {
      recipient?: {
        teamMemberships?: { teamId: string }[];
        departmentMemberships?: { departmentId: string }[];
      };
    }
  >;
  message: string;
  total_points: number;
  category?: { id: string };
  categories?: string[];
}

export interface ShoutoutMessage {
  message: string;
  total_points: number;
}

export interface OAuthStateData {
  tenantId: string;
  tenantMemberId: string;
  platformType: IntegrationType;
  timestamp: number;
}

export interface OAuthTokenData {
  access_token: string;
  refresh_token?: string;
  user_id: string;
  username: string;
  scope?: string;
  expires_in?: number;
  team_id?: string;
  team_name?: string;
  bot_token?: string;
  botToken?: string;
}

export interface IntegrationSyncStatus {
  total: number;
  matched: number;
  unmatched: number;
  matchRate: number;
}

export interface SlackUrlVerificationPayload {
  type: 'url_verification';
  challenge: string;
}

export interface SlackInteractiveBody {
  payload: string;
}

export interface SlackEventPayload {
  type?: string;
  event?: SlackEvent;
  team_id?: string;
}

export interface SlackEvent {
  type: string;
  user?: SlackEventUser;
}

export interface SlackEventUser {
  id: string;
  name?: string;
  real_name?: string;
  profile?: {
    email?: string;
    image_192?: string;
  };
}

export interface SlackInteractivePayload {
  type: string;
  user: { id: string };
  team: { id: string };
  actions: Array<{ action_id: string }>;
  view?: { callback_id: string };
  callback_id?: string;
}

export interface SlackSlashCommandPayload {
  command: string;
  text: string;
  user_id: string;
  team_id: string;
  channel_id: string;
}
