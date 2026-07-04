import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_NO_BILLING_CARD,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWalletService } from './tenant-wallet.service';

describe('TenantWalletService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  function createService(overrides?: {
    wallet?: Record<string, unknown>;
    debitUpdateAffected?: number;
    nombaCharge?: jest.Mock;
    nombaVerify?: jest.Mock;
    paymentMethodId?: string | null;
  }) {
    const wallet = {
      id: 'wallet-1',
      tenantId,
      currencyCode: 'NGN',
      balanceAmount: 500,
      virtualAccountNumber: null,
      virtualAccountStatus: null,
      autoTopupEnabled: false,
      autoTopupThreshold: 1000,
      autoTopupAmount: 5000,
      ...overrides?.wallet,
    };

    const txRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (tx) => tx),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const walletRepo = {
      findOne: jest.fn().mockResolvedValue(wallet),
      findOneOrFail: jest.fn().mockResolvedValue(wallet),
      create: jest.fn((data) => data),
      save: jest.fn(async (w) => w),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          affected: overrides?.debitUpdateAffected ?? 1,
        }),
      }),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TenantWallet') return walletRepo;
        if (entity.name === 'TenantWalletTransaction') return txRepo;
        return {};
      }),
    };

    const dataSource = {
      getRepository: jest.fn((entity) => {
        if (entity.name === 'TenantWallet') return walletRepo;
        if (entity.name === 'TenantWalletTransaction') return txRepo;
        return {};
      }),
      manager,
    };

    const nombaVirtualAccountApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      createVirtualAccount: jest.fn(),
    };

    const nombaApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      chargeTokenizedCard:
        overrides?.nombaCharge ?? jest.fn().mockResolvedValue({ orderReference: 'order-1' }),
      verifyTransaction:
        overrides?.nombaVerify ?? jest.fn().mockResolvedValue({ status: 'success', amount: 5000 }),
      createCheckoutOrder: jest.fn().mockResolvedValue({
        checkoutLink: 'https://checkout.nomba.com/test',
        orderReference: 'wallet-topup-ref',
      }),
    };

    const subscriptionsService = {
      getTenantSubscription: jest.fn().mockResolvedValue({
        paymentMethodId:
          overrides?.paymentMethodId !== undefined ? overrides.paymentMethodId : 'tok-1',
      }),
    };

    const tenantSettingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        settings: { billing: { contactEmail: 'billing@test.com' } },
      }),
    };

    const emailService = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: tenantId, name: 'Acme Corp', slug: 'acme' }),
    };

    const activitiesService = {
      queueActivity: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TenantWalletService(
      dataSource as any,
      nombaVirtualAccountApi as any,
      nombaApi as any,
      subscriptionsService as any,
      tenantSettingsService as any,
      emailService as any,
      activitiesService as any,
      tenantRepository as any,
    );

    return {
      service,
      walletRepo,
      txRepo,
      nombaApi,
      nombaVirtualAccountApi,
      emailService,
      manager,
    };
  }

  describe('provisioning', () => {
    it('skips provision when wallet is already ACTIVE', async () => {
      const { service, nombaVirtualAccountApi } = createService({
        wallet: {
          virtualAccountNumber: '9900012345',
          virtualAccountStatus: 'ACTIVE',
        },
      });
      nombaVirtualAccountApi.createVirtualAccount = jest.fn();

      const result = await service.provisionVirtualAccount(tenantId);
      expect(result.virtualAccountNumber).toBe('9900012345');
      expect(nombaVirtualAccountApi.createVirtualAccount).not.toHaveBeenCalled();
    });
  });

  describe('debit', () => {
    it('throws member message when balance is insufficient', async () => {
      const { service, manager } = createService({ debitUpdateAffected: 0 });

      await expect(service.debit(tenantId, 100, 'ref-1', 'test', manager as any)).rejects.toThrow(
        WALLET_UNAVAILABLE_MEMBER,
      );
    });

    it('throws when auto-topup charge fails', async () => {
      const { service, manager, nombaApi, emailService } = createService({
        wallet: {
          autoTopupEnabled: true,
          autoTopupThreshold: 1000,
          autoTopupAmount: 5000,
          balanceAmount: 500,
        },
        nombaCharge: jest.fn().mockRejectedValue(new Error('card declined')),
      });

      await expect(service.debit(tenantId, 100, 'ref-1', 'test', manager as any)).rejects.toThrow(
        WALLET_UNAVAILABLE_MEMBER,
      );

      expect(nombaApi.chargeTokenizedCard).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('manualTopup', () => {
    it('throws billing card message when subscription has no tokenized card', async () => {
      const { service, nombaApi, emailService } = createService({ paymentMethodId: null });

      await expect(service.manualTopup(tenantId, 5000)).rejects.toThrow(WALLET_NO_BILLING_CARD);

      expect(nombaApi.chargeTokenizedCard).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws admin message when verification fails', async () => {
      const { service, txRepo, emailService } = createService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'failed', amount: 5000 }),
      });

      await expect(service.manualTopup(tenantId, 5000)).rejects.toThrow(WALLET_CHARGE_FAILED_ADMIN);

      expect(txRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('throws admin message when paid amount mismatches', async () => {
      const { service, txRepo, emailService } = createService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'success', amount: 100 }),
      });

      await expect(service.manualTopup(tenantId, 5000)).rejects.toThrow(WALLET_CHARGE_FAILED_ADMIN);

      expect(txRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('createTopupCheckout', () => {
    it('creates checkout with wallet_topup billing meta', async () => {
      const { service, nombaApi } = createService();

      const result = await service.createTopupCheckout(tenantId, 2500);

      expect(result.checkoutUrl).toBe('https://checkout.nomba.com/test');
      expect(nombaApi.createCheckoutOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500,
          currency: 'NGN',
          customerEmail: 'billing@test.com',
          tokenizeCard: false,
          meta: expect.objectContaining({
            tenantId,
            billingType: 'wallet_topup',
            expectedAmount: 2500,
          }),
        }),
      );
      const orderReference = nombaApi.createCheckoutOrder.mock.calls[0][0].orderReference;
      expect(orderReference).toMatch(new RegExp(`^wt_${tenantId.replace(/-/g, '')}_`));
      expect(orderReference.length).toBeLessThanOrEqual(50);
      expect(nombaApi.createCheckoutOrder.mock.calls[0][0].callbackUrl).toContain(
        '/acme/settings?tab=rewards&wallet_topup=done',
      );
    });

    it('rejects non-positive amounts', async () => {
      const { service, nombaApi } = createService();

      await expect(service.createTopupCheckout(tenantId, 0)).rejects.toThrow(
        'Top up amount must be greater than 0',
      );
      expect(nombaApi.createCheckoutOrder).not.toHaveBeenCalled();
    });
  });

  describe('completeCheckoutTopup', () => {
    it('credits wallet once for a successful checkout payment', async () => {
      const { service, txRepo, nombaApi } = createService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'success', amount: 2500 }),
      });

      const result = await service.completeCheckoutTopup({
        tenantId,
        orderReference: 'wallet-topup-ref-1',
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: true });
      expect(nombaApi.verifyTransaction).toHaveBeenCalledWith('wallet-topup-ref-1');
      expect(txRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEPOSIT',
          amount: 2500,
          reference: 'wallet-topup-ref-1',
        }),
      );
    });

    it('is idempotent when reference already exists', async () => {
      const { service, txRepo, nombaApi } = createService();
      txRepo.findOne.mockResolvedValue({ id: 'tx-1', reference: 'wallet-topup-ref-1' });

      const result = await service.completeCheckoutTopup({
        tenantId,
        orderReference: 'wallet-topup-ref-1',
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: false });
      expect(nombaApi.verifyTransaction).not.toHaveBeenCalled();
      expect(txRepo.save).not.toHaveBeenCalled();
    });
  });
});
