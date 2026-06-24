export const SHOUTOUT_CREATED_EVENT = 'shoutout.created';

export interface ShoutoutCreatedEventPayload {
  tenantId: string;
  shoutoutId: string;
  senderMemberId: string;
  recipientIds: string[];
  totalPoints: number;
  pointsPerRecipient: number;
  message: string;
  categoryNames: string[];
  source: 'api' | 'slack' | 'celebration';
}
