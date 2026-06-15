export interface CreatePaymentData {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  countryCode?: string;
  network?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}
