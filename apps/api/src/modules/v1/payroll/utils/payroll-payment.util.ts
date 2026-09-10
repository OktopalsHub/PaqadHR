import { formatNombaSenderName } from 'src/common/config/nomba.config';
import { isCryptoCurrency } from 'src/common/constants/crypto-currencies.constant';
import { PaymentMethodType } from 'src/common/enums/payment-type.enum';
import type { CreatePaymentData } from 'src/common/interfaces/create-payment-data.interface';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import type { PayrollItem } from '../entities/payroll-item.entity';

import { buildPayrollMerchantRef } from './payroll-merchant-ref.util';

export function buildPayrollPaymentData(
  item: PayrollItem,
  paymentMethod: PaymentMethod,
  employeeName: string,
  tenantName?: string,
  payrollRunTitle?: string,
): CreatePaymentData {
  const meta = paymentMethod.metadata ?? {};
  const baseDescription = payrollRunTitle
    ? `${payrollRunTitle} for ${employeeName}`
    : `Payroll payment for ${employeeName}`;
  const currency = item.paymentCurrency;
  const isCrypto = paymentMethod.type === PaymentMethodType.CRYPTO || isCryptoCurrency(currency);
  const retryAttempt =
    typeof item.metadata?.payoutRetryCount === 'number' ? item.metadata.payoutRetryCount : 0;

  return {
    amount: Number(item.paymentAmount),
    currency,
    description: item.description ?? baseDescription,
    accountNumber: isCrypto
      ? ((meta.walletAddress as string | undefined) ?? paymentMethod.accountNumber ?? undefined)
      : (paymentMethod.accountNumber ?? undefined),
    accountName: paymentMethod.accountName ?? undefined,
    bankCode: paymentMethod.bankCode ?? undefined,
    bankName: paymentMethod.bankName ?? undefined,
    countryCode: paymentMethod.country ?? undefined,
    network: isCrypto ? ((meta.cryptoNetwork as string | undefined) ?? undefined) : undefined,
    senderName: formatNombaSenderName(tenantName),
    merchantTxRef: buildPayrollMerchantRef(item.payrollRunId, item.id, retryAttempt),
    paymentRail: typeof meta.nombaPaymentMethod === 'string' ? meta.nombaPaymentMethod : undefined,
    institutionCode:
      typeof meta.institutionCode === 'string'
        ? meta.institutionCode
        : (paymentMethod.bankCode ?? undefined),
    institutionName:
      typeof meta.institutionName === 'string'
        ? meta.institutionName
        : (paymentMethod.bankName ?? undefined),
    accountType: meta.accountType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL',
    bankAccountType: meta.bankAccountType === 'SAVINGS' ? 'SAVINGS' : 'CHECKING',
    purposeOfPayment: typeof meta.purposeOfPayment === 'string' ? meta.purposeOfPayment : 'PAYROLL',
    metadata: {
      payrollRunId: item.payrollRunId,
      payrollItemId: item.id,
      memberId: item.memberId,
      paymentMethodId: paymentMethod.id,
      walletAddress: meta.walletAddress,
      cryptoNetwork: meta.cryptoNetwork,
      noahChannelId: meta.noahChannelId,
      tenantName,
    },
  };
}
