export interface SSENotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  tenantId?: string;
  recipientId?: string;
  metadata?: Record<string, unknown>;
  actionData?: {
    url?: string;
    buttonText?: string;
    actionType?: string;
  };
  timestamp: Date;
}
