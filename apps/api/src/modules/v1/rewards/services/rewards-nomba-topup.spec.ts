import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RewardsService } from './rewards.service';

describe('RewardsService Nomba topup', () => {
  let service: RewardsService;
  let purchaseAirtime: jest.Mock;
  let purchaseDataBundle: jest.Mock;
  let listDataPlans: jest.Mock;

  beforeEach(() => {
    purchaseAirtime = jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'tx-airtime',
      status: 'SUCCESS',
    });
    purchaseDataBundle = jest.fn().mockResolvedValue({
      success: true,
      transactionId: 'tx-data',
      status: 'SUCCESS',
    });
    listDataPlans = jest.fn().mockResolvedValue([
      { amount: 1000, plan: '1GB' },
      { amount: 2000, plan: '2GB' },
    ]);

    service = new RewardsService(
      {
        getRepository: jest.fn(() => ({
          findOne: jest.fn(),
          update: jest.fn(),
        })),
      } as unknown as DataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        isConfigured: jest.fn().mockReturnValue(true),
        purchaseAirtime,
        purchaseDataBundle,
        listDataPlans,
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('lists Nomba data plans for a network', async () => {
    const plans = await service.listNombaDataPlans('MTN');
    expect(plans).toEqual([
      { amount: 1000, plan: '1GB' },
      { amount: 2000, plan: '2GB' },
    ]);
    expect(listDataPlans).toHaveBeenCalledWith('MTN');
  });

  it('rejects Reloadly airtime for NGN workspace currency', () => {
    expect(() =>
      (service as any).assertNgNombaRouting(
        {
          rewardType: 'RELOADLY_AIRTIME',
          currencyCode: 'NGN',
          currencyValue: 1000,
          pointsCost: 1020,
          rewardId: 'RELOADLY_AIRTIME',
        },
        { rewardsCurrency: 'NGN' },
      ),
    ).toThrow(BadRequestException);
  });
});
