import type { PaymentProvider } from 'src/common/enums/payment-provider.enum';

export type PayrollFundPreflight = {
  ok: boolean;
  provider: PaymentProvider;
  currency: string;
  requiredAmount: number;
  availableBalance: number | null;
  shortfall: number;
  balanceSupported: boolean;
  canCheckout: boolean;
  dashboardUrl: string;
  message: string;
  /** Employee payout total in funding currency (before Paqad fee). */
  employeeTotal?: number;
  platformFee?: number;
  feePercentage?: number;
  /** Additional provider payout-fee reserve, separate from the PaqadHR platform fee. */
  payoutFeeReserve?: number;
  payoutFeePerTransfer?: number;
  payoutTransferCount?: number;
  nombaTransferCharge?: number;
  bridgeFundingRequirements?: Array<{
    currency: string;
    network: string;
    requiredAmount: string;
    availableBalance: string;
    shortfall: string;
  }>;
};
