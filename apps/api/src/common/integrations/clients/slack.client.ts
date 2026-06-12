import { WebClient } from '@slack/web-api';
import { IPlatformClient, IPlatformUser } from 'src/common/interfaces';
import { ShoutoutMessage } from '../integration.types';

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
      return members.filter((u) => u.email);
    } catch (error) {
      return [];
    }
  }
  async listUsers(): Promise<IPlatformUser[]> {
    try {
      const res = await this.client.users.list({ limit: 200 });
      return (
        res.members
          ?.map((u) => ({
            id: u.id ?? '',
            username: u.name ?? '',
            displayName: u.real_name ?? '',
            email: u.profile?.email,
            avatarUrl: u.profile?.image_192,
          }))
          .filter((u) => !u.username?.startsWith('bot.') && u.email) || []
      );
    } catch (error) {
      return [];
    }
  }
  async sendMessage(channelId: string, message: string): Promise<unknown> {
    try {
      return this.client.chat.postMessage({
        channel: channelId,
        text: message,
      });
    } catch (error) {
      throw error;
    }
  }
  createShoutoutMessage(shoutout: ShoutoutMessage): string {
    return `*New Shoutout!*\n${shoutout.message}\n${shoutout.total_points} points awarded!`;
  }
}
