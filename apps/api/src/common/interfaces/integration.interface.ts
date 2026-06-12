export interface PlatformMessage {
  text: string;
  attachments?: unknown[];
  blocks?: unknown[];
  channel?: string;
  threadTs?: string;
}
export interface IPlatformUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}
export interface IPlatformClient {
  sendMessage(channelId: string, message: string): Promise<unknown>;
  listUsers(): Promise<unknown>;
  getChannelMembers(channelId: string): Promise<IPlatformUser[]>;
  createShoutoutMessage(shoutout: unknown): unknown;
}
export interface ChannelInfo {
  id: string;
  name: string;
  type: 'public' | 'private';
  memberCount?: number;
  description?: string;
}
