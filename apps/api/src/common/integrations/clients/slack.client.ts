import { WebClient } from '@slack/web-api';
import type { IPlatformUser } from 'src/common/interfaces';
import { IPlatformClient } from 'src/common/interfaces';
import type { ShoutoutMessage } from '../integration.types';

export class SlackClient implements IPlatformClient {
  client: WebClient;
  constructor(token: string) {
    this.client = new WebClient(token);
  }
  async getChannelMembers(channelId: string): Promise<IPlatformUser[]> {
    try {
      const res = await this.client.conversations.members({
        channel: channelId,
      });
      const members = await Promise.all(
        res.members?.map(async (userId: string) => {
          const user = await this.client.users.info({ user: userId });
          return {
            id: userId,
            username: user.user?.name ?? '',
            displayName: user.user?.real_name ?? '',
            email: user.user?.profile?.email,
            avatarUrl: user.user?.profile?.image_192,
          };
        }) || [],
      );
      return members.filter((u) => u.id && !u.username?.startsWith('bot.'));
    } catch (_error) {
      return [];
    }
  }
  async listUsers(): Promise<IPlatformUser[]> {
    try {
      const res = await this.client.users.list({ limit: 200 });
      return (
        res.members
          ?.filter((u) => !u.is_bot && !u.deleted && u.id)
          ?.map((u) => ({
            id: u.id ?? '',
            username: u.name ?? '',
            displayName: u.real_name ?? u.profile?.real_name ?? '',
            email: u.profile?.email,
            avatarUrl: u.profile?.image_192,
          })) ?? []
      );
    } catch (_error) {
      return [];
    }
  }
  async sendMessage(channelId: string, message: string): Promise<unknown> {
    return this.client.chat.postMessage({
      channel: channelId,
      text: message,
    });
  }
  createShoutoutMessage(shoutout: ShoutoutMessage): string {
    return `*New Shoutout!*\n${shoutout.message}\n${shoutout.total_points} points awarded!`;
  }
}
