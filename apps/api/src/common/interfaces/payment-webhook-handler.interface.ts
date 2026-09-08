export interface WebhookHandlerContext {
  rawBody: string;
  headers: Record<string, string>;
}

export interface PaymentWebhookHandler {
  dispatch(ctx: WebhookHandlerContext): Promise<{ received: boolean }>;
}
