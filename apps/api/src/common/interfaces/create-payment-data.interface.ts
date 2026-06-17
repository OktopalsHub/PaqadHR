export interface CreatePaymentData {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  countryCode?: string;
  network?: string;
  callbackUrl?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  bankName?: string;
  merchantTxRef?: string;
  senderName?: string;
  /** Nomba global payout rail, e.g. BANK, ACH, SEPA, FASTER_PAYMENTS, MobileMoney */
  paymentRail?: string;
  institutionCode?: string;
  institutionName?: string;
  accountType?: 'INDIVIDUAL' | 'CORPORATE';
  bankAccountType?: 'CHECKING' | 'SAVINGS';
  purposeOfPayment?: string;
  metadata?: Record<string, unknown>;
}
