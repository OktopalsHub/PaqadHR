export const SHOUTOUT_CREATED_EVENT = 'shoutout.created';

export interface ShoutoutCreatedEventPayload {
  tenantId: string;
  shoutoutId: string;
  senderMemberId: string;
  senderUserId: string | null;
  recipients: { recipientId: string; points: number }[];
  recipientIds: string[];
  totalPoints: number;
  message: string;
  categoryNames: string[];
  source: 'api' | 'slack' | 'celebration';
}
