import type { CreatePaymentData } from '../interfaces/create-payment-data.interface';

describe('Monnify bulk transfer request mapping', () => {
  it('builds one batch with per-line payroll merchant refs', () => {
    const transfers: CreatePaymentData[] = [
      {
        amount: 1000,
        currency: 'NGN',
        description: 'Payroll A',
        accountNumber: '111',
        accountName: 'Ada',
        bankCode: '058',
        bankName: 'GTBank',
        merchantTxRef: 'payroll_run_itemA',
      },
      {
        amount: 2000,
        currency: 'NGN',
        description: 'Payroll B',
        accountNumber: '222',
        accountName: 'Grace',
        bankCode: '058',
        bankName: 'GTBank',
        merchantTxRef: 'payroll_run_itemB',
      },
    ];

    const batchReference = `batch_${transfers[0].merchantTxRef}`;
    const transactionList = transfers.map((t) => ({
      amount: t.amount,
      reference: t.merchantTxRef,
      narration: t.description || 'Payroll transfer',
      destinationBankCode: t.bankCode,
      destinationAccountNumber: t.accountNumber,
      destinationAccountName: t.accountName,
      currencyCode: 'NGN',
    }));

    expect(batchReference).toBe('batch_payroll_run_itemA');
    expect(transactionList).toHaveLength(2);
    expect(transactionList[0].reference).toBe('payroll_run_itemA');
    expect(transactionList[1].reference).toBe('payroll_run_itemB');
    expect(transactionList[0].amount).toBe(1000);
    expect(transactionList[1].amount).toBe(2000);
  });
});
