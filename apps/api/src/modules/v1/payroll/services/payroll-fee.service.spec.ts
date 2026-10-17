import { PayrollFeeService } from './payroll-fee.service';

describe('PayrollFeeService', () => {
  const createService = (feePercentage = 2) => {
    const subscriptionsService = {
      getTenantSubscription: jest.fn().mockResolvedValue({
        planPrice: { regionalConfig: { payrollFeePercentage: feePercentage } },
      }),
    };
    return new PayrollFeeService(subscriptionsService as never);
  };

  it('keeps the platform percentage separate from the NGN payout reserve', async () => {
    const service = createService(2);

    await expect(
      service.calculatePayrollFee({
        totalPayrollAmount: 10_000,
        currency: 'NGN',
        tenantId: 'tenant-1',
        transferCount: 3,
      }),
    ).resolves.toMatchObject({
      originalAmount: 10_000,
      platformFee: 200,
      payoutFeePerTransfer: 100,
      payoutFeeReserve: 300,
      payoutTransferCount: 3,
      totalAmountToCharge: 10_500,
      feePercentage: 2,
      breakdown: {
        employeePayments: 10_000,
        platformFee: 200,
        payoutFeeReserve: 300,
      },
    });
  });

  it('adds one NGN payout reserve for each item in the fee preview', async () => {
    const service = createService(2);

    const result = await service.previewPayrollFees(
      [
        { amount: 10_000, currency: 'NGN' },
        { amount: 20_000, currency: 'NGN' },
      ],
      'tenant-1',
    );

    expect(result.totalPayoutFeeReserves).toEqual({ NGN: 200 });
    expect(result.totalChargeAmount.NGN).toBe(30_800);
    expect(result.byCurrency).toHaveLength(2);
  });

  it('does not add an NGN reserve to other currencies by default', async () => {
    const service = createService(2);

    const result = await service.calculatePayrollFee({
      totalPayrollAmount: 1_000,
      currency: 'USD',
      tenantId: 'tenant-1',
      transferCount: 4,
    });

    expect(result.payoutFeeReserve).toBe(0);
    expect(result.totalAmountToCharge).toBe(1_020);
  });
});
