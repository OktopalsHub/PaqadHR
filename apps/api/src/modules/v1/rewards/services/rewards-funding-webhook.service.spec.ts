import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MisdirectedDeposit } from '../entities/misdirected-deposit.entity';
import { TenantWallet } from '../entities/tenant-wallet.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { RewardsService } from './rewards.service';
import { TenantWalletService } from './tenant-wallet.service';

describe('RewardsService.processNombaFundingPayload', () => {
  let service: RewardsService;
  let walletService: { credit: jest.Mock };
  let walletRepo: { findOne: jest.Mock };
  let misdirectedRepo: { create: jest.Mock; save: jest.Mock };
  let txRepo: { findOne: jest.Mock };

  const wallet = {
    id: 'wallet-1',
    tenantId: 'tenant-1',
    virtualAccountNumber: '9900012345',
  };

  beforeEach(() => {
    walletService = { credit: jest.fn().mockResolvedValue(wallet) };
    walletRepo = { findOne: jest.fn().mockResolvedValue(wallet) };
    misdirectedRepo = {
      create: jest.fn((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    };
    txRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === TenantWallet) return walletRepo;
        if (entity === MisdirectedDeposit) return misdirectedRepo;
        if (entity === TenantWalletTransaction) return txRepo;
        return {};
      }),
      transaction: jest.fn(async (cb: (mgr: { getRepository: () => typeof txRepo }) => unknown) =>
        cb({ getRepository: () => txRepo }),
      ),
    };

    service = new RewardsService(
      dataSource as unknown as DataSource,
      walletService as unknown as TenantWalletService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('credits wallet for known virtual account', async () => {
    const payload = {
      event_type: 'deposit.success',
      data: {
        virtualAccount: '9900012345',
        amount: 5000,
        transactionReference: 'ref-123',
        senderName: 'John Doe',
      },
    };

    const result = await service.processNombaFundingPayload(payload);
    expect(result).toEqual({ received: true });
    expect(walletService.credit).toHaveBeenCalled();
  });

  it('records misdirected deposit for unknown account', async () => {
    walletRepo.findOne.mockResolvedValue(null);

    const payload = {
      event_type: 'deposit.success',
      data: {
        virtualAccount: '9999999999',
        amount: 1000,
        transactionReference: 'ref-unknown',
      },
    };

    const result = await service.processNombaFundingPayload(payload);
    expect(result).toEqual({ received: true });
    expect(misdirectedRepo.save).toHaveBeenCalled();
    expect(walletService.credit).not.toHaveBeenCalled();
  });

  it('rejects invalid payload', async () => {
    await expect(
      service.processNombaFundingPayload({
        event_type: 'deposit.success',
        data: { virtualAccount: '9900012345' },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
