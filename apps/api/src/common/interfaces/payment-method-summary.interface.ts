import type { PaymentMethodType } from 'src/common/enums';
import type { PaymentMethodStatus } from '../enums/payment-method-status.enum';

export interface PaymentMethodSummary {
  id: string;
  type: PaymentMethodType;
  currency: string;
  displayInfo: string;
  status: PaymentMethodStatus;
  isPrimary: boolean;
  isVerified: boolean;
  canReceivePayments: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}
