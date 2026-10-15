export interface ShoutoutRecipientInput {
  recipientId: string;
  points: number;
}

export interface CreateShoutoutInput {
  recipients: ShoutoutRecipientInput[];
  message: string;
  categoryIds?: string[];
  source?: 'api' | 'slack';
}
