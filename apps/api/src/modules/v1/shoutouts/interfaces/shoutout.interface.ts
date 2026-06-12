export interface CreateShoutoutInput {
  recipientIds: string[];
  pointsPerRecipient: number;
  message: string;
  categoryIds?: string[];
  source?: 'api' | 'slack';
}
