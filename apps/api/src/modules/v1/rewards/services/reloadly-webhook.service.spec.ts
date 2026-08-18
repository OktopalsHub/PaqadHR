import { DataSource } from 'typeorm';
import { ShoutoutMemberPoints } from '../../shoutouts/entities/shoutout-member-points.entity';
import { ShoutoutPointTransaction } from '../../shoutouts/entities/shoutout-point-transaction.entity';
import { RewardRedemption } from '../entities/reward-redemption.entity';
import { TenantWalletTransaction } from '../entities/tenant-wallet-transaction.entity';
import { ReloadlyWebhookService } from './reloadly-webhook.service';
import { TenantWalletService } from './tenant-wallet.service';

describe('ReloadlyWebhookService', () => {
  let service: ReloadlyWebhookService;
  let mockDataSource: any;
  let mockWalletService: any;
  let mockRedemptionRepo: any;
  let mockPointsRepo: any;
  let mockTxRepo: any;
  let mockWalletTxRepo: any;
  let mockEntityManager: any;

  beforeEach(() => {
    mockRedemptionRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    mockPointsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
      findOneOrFail: jest.fn().mockResolvedValue({ currentBalance: 1500 }),
    };

    mockTxRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
    };

    mockWalletTxRepo = {
      findOne: jest.fn(),
    };

    mockEntityManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === RewardRedemption) return mockRedemptionRepo;
        if (entity === ShoutoutMemberPoints) return mockPointsRepo;
        if (entity === ShoutoutPointTransaction) return mockTxRepo;
        if (entity === TenantWalletTransaction) return mockWalletTxRepo;
        return null;
      }),
    };

    mockDataSource = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === RewardRedemption) return mockRedemptionRepo;
        return null;
      }),
      transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockEntityManager);
      }),
    };

    mockWalletService = {
      credit: jest.fn().mockResolvedValue({}),
      ensureWallet: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
    };

    service = new ReloadlyWebhookService(
      mockDataSource as unknown as DataSource,
      mockWalletService as unknown as TenantWalletService,
    );
  });

  describe('processReloadlyWebhookEvent', () => {
    const mockRedemptionId = 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6';

    it('should ignore if payload has no customIdentifier', async () => {
      await service.processReloadlyWebhookEvent({});
      expect(mockRedemptionRepo.findOne).not.toHaveBeenCalled();
    });

    it('should ignore if redemption is not found', async () => {
      mockRedemptionRepo.findOne.mockResolvedValue(null);
      await service.processReloadlyWebhookEvent({
        status: 'SUCCESSFUL',
        transaction: { customIdentifier: mockRedemptionId },
      });
      expect(mockRedemptionRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockRedemptionId },
      });
    });

    it('should update redemption status to SUCCESS on SUCCESSFUL event', async () => {
      const redemption = {
        id: mockRedemptionId,
        status: 'PENDING',
        providerRef: null,
      };
      mockRedemptionRepo.findOne.mockResolvedValue(redemption);

      await service.processReloadlyWebhookEvent({
        status: 'SUCCESSFUL',
        transaction: {
          customIdentifier: mockRedemptionId,
          transactionId: 9999,
        },
      });

      expect(mockRedemptionRepo.update).toHaveBeenCalledWith(mockRedemptionId, {
        status: 'SUCCESS',
        providerRef: { txRef: '9999' },
      });
    });

    it('should refund member and wallet, and mark FAILED on FAILED event', async () => {
      const redemption = {
        id: mockRedemptionId,
        status: 'SUCCESS',
        pointsSpent: 100,
        tenantId: 'tenant-123',
        memberId: 'member-456',
        rewardType: 'RELOADLY_AIRTIME',
        rewardName: 'MTN Airtime',
      };
      mockRedemptionRepo.findOne.mockResolvedValue(redemption);
      mockRedemptionRepo.findOneOrFail = jest.fn().mockResolvedValue(redemption);

      mockWalletTxRepo.findOne.mockResolvedValue({
        amount: -500,
      });

      await service.processReloadlyWebhookEvent({
        status: 'FAILED',
        transaction: {
          customIdentifier: mockRedemptionId,
          transactionId: 9999,
        },
      });

      // 1. Points re-credited
      expect(mockPointsRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          points: 100,
          description: expect.stringContaining('Refund: MTN Airtime'),
        }),
      );

      // 2. Tenant wallet credited back
      expect(mockWalletService.credit).toHaveBeenCalledWith(
        'tenant-123',
        500,
        'REFUND',
        mockRedemptionId,
        'Refund: MTN Airtime',
        mockEntityManager,
        { actorMemberId: 'member-456' },
      );

      // 3. Redemption marked failed
      expect(mockRedemptionRepo.update).toHaveBeenCalledWith(mockRedemptionId, {
        status: 'FAILED',
        providerRef: { error: 'Reloadly transaction failed' },
      });
    });
  });
});
