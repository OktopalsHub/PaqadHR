import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';

import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../entities/payroll-item.entity';

export const NOMBA_BATCH_SIZE = 5;

export function hasConfirmedNombaFeeConfiguration(): boolean {
  const configured = process.env.PAYROLL_PAYOUT_FEE_NOMBA_NGN?.trim();
  return (
    configured !== undefined &&
    configured !== '' &&
    Number.isFinite(Number(configured)) &&
    Number(configured) >= 0
  );
}

export function isVerifiedNgnDestination(
  item: PayrollItem,
  method?: PaymentMethod,
): method is PaymentMethod {
  return Boolean(
    method &&
    method.memberId === item.memberId &&
    method.type === PaymentMethodType.BANK &&
    method.status === PaymentMethodStatus.VERIFIED &&
    method.currency?.toUpperCase() === 'NGN' &&
    method.country?.toUpperCase() === 'NG' &&
    method.bankCode &&
    /^\d{10}$/.test(method.accountNumber ?? '') &&
    method.accountName,
  );
}
