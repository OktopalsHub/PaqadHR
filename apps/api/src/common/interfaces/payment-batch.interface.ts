import type { PayrollItem } from '../../modules/v1/payroll/entities/payroll-item.entity';

export interface PaymentBatch {
  fiatPayments: PayrollItem[];
}
