import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CREDIT_FAILED,
  WALLET_NO_BILLING_CARD,
  WALLET_UNAVAILABLE_MEMBER,
} from '../constants/wallet-error-messages';
import { TenantWalletService } from './tenant-wallet.service';
import { TenantWalletTopupService } from './tenant-wallet-topup.service';

describe('TenantWalletService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  function createWalletService(overrides?: {
    wallet?: Record<string, unknown>;
    debitUpdateAffected?: number;
  }) {
    const wallet = {
      id: 'wallet-1',
      tenantId,
      currencyCode: 'NGN',
      balanceAmount: 500,
      autoTopupEnabled: false,
      autoTopupThreshold: 1000,
      autoTopupAmount: 5000,
      ...overrides?.wallet,
    };

    const txRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (tx) => tx),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
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

    const tenantRecord = { id: tenantId, preferredCurrency: 'NGN' };
    const tenantsService = {
      findOne: jest.fn().mockResolvedValue(tenantRecord),
      getTenant: jest.fn().mockResolvedValue(tenantRecord),
    };

    const walletService = new TenantWalletService(
      dataSource as any,
      { queueActivity: jest.fn().mockResolvedValue(undefined) } as any,
      tenantsService as any,
    );

    return { walletService, walletRepo, txRepo, manager };
  }

  describe('debit', () => {
    it('throws member message when balance is insufficient', async () => {
      const { walletService, manager } = createWalletService({ debitUpdateAffected: 0 });

      await expect(
        walletService.debit(tenantId, 100, 'ref-1', 'test', manager as any),
      ).rejects.toThrow(WALLET_UNAVAILABLE_MEMBER);
    });
  });
});

describe('TenantWalletTopupService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const walletTopupRef = `wt_${tenantId.replace(/-/g, '')}_ref1`;
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;

  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
  });

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
  });

  function createTopupService(overrides?: {
    wallet?: Record<string, unknown>;
    nombaCharge?: jest.Mock;
    nombaVerify?: jest.Mock;
    paymentMethodId?: string | null;
  }) {
    const wallet = {
      id: 'wallet-1',
      tenantId,
      currencyCode: 'NGN',
      balanceAmount: 500,
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
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
        setLock: jest.fn().mockReturnThis(),
        getOneOrFail: jest.fn().mockResolvedValue(wallet),
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
      transaction: jest.fn(async (fn: (mgr: typeof manager) => Promise<unknown>) => fn(manager)),
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

    const noahApi = {
      createPayinCheckout: jest.fn().mockResolvedValue({
        checkoutLink: 'https://checkout.noah.com/test',
        orderReference: 'nw_wallet-topup-ref',
      }),
      verifyTransaction: jest.fn().mockResolvedValue({ status: 'success', amount: 5000 }),
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

    const emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: tenantId, name: 'Acme Corp', slug: 'acme' }),
    };

    const walletService = {
      ensureWallet: jest.fn().mockResolvedValue(wallet),
      credit: jest.fn().mockResolvedValue(wallet),
    };

    const topupService = new TenantWalletTopupService(
      dataSource as any,
      walletService as any,
      nombaApi as any,
      noahApi as any,
      subscriptionsService as any,
      tenantSettingsService as any,
      emailService as any,
      tenantRepository as any,
    );

    return {
      topupService,
      walletService,
      txRepo,
      nombaApi,
      noahApi,
      emailService,
      manager,
      walletRepo,
    };
  }

  describe('maybeAutoTopupAfterDebit', () => {
    it('throws when auto-topup charge fails', async () => {
      const { topupService, nombaApi, emailService } = createTopupService({
        wallet: {
          autoTopupEnabled: true,
          autoTopupThreshold: 1000,
          autoTopupAmount: 5000,
          balanceAmount: 500,
        },
        nombaCharge: jest.fn().mockRejectedValue(new Error('card declined')),
      });

      await expect(topupService.maybeAutoTopupAfterDebit(tenantId)).rejects.toThrow(
        WALLET_UNAVAILABLE_MEMBER,
      );

      expect(nombaApi.chargeTokenizedCard).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('manualTopup', () => {
    it('throws billing card message when subscription has no tokenized card', async () => {
      const { topupService, nombaApi, emailService } = createTopupService({
        paymentMethodId: null,
      });

      await expect(topupService.manualTopup(tenantId, 5000)).rejects.toThrow(
        WALLET_NO_BILLING_CARD,
      );

      expect(nombaApi.chargeTokenizedCard).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws admin message when verification fails', async () => {
      const { topupService, walletService, emailService } = createTopupService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'failed', amount: 5000 }),
      });

      await expect(topupService.manualTopup(tenantId, 5000)).rejects.toThrow(
        WALLET_CHARGE_FAILED_ADMIN,
      );

      expect(walletService.credit).not.toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('does not send charge-failed email when payment succeeds but credit fails', async () => {
      const { topupService, walletService, emailService } = createTopupService({});
      walletService.credit.mockRejectedValue(new Error('db deadlock'));

      await expect(topupService.manualTopup(tenantId, 5000)).rejects.toThrow(WALLET_CREDIT_FAILED);

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('createTopupCheckout', () => {
    it('creates checkout with wallet_topup billing meta', async () => {
      const { topupService, nombaApi } = createTopupService();

      const result = await topupService.createTopupCheckout(tenantId, 2500);

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
      const { topupService, nombaApi } = createTopupService();

      await expect(topupService.createTopupCheckout(tenantId, 0)).rejects.toThrow(
        'Top up amount must be greater than 0',
      );
      expect(nombaApi.createCheckoutOrder).not.toHaveBeenCalled();
    });
  });

  describe('completeCheckoutTopup', () => {
    it('credits wallet once for a successful checkout payment', async () => {
      const { topupService, walletService, nombaApi } = createTopupService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'success', amount: 2500 }),
      });

      const result = await topupService.completeCheckoutTopup({
        tenantId,
        orderReference: walletTopupRef,
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: true });
      expect(nombaApi.verifyTransaction).toHaveBeenCalledWith(walletTopupRef);
      expect(walletService.credit).toHaveBeenCalled();
    });

    it('is idempotent when reference already exists', async () => {
      const { topupService, walletService, nombaApi, txRepo } = createTopupService();
      txRepo.findOne.mockResolvedValue({ id: 'tx-1', reference: walletTopupRef });

      const result = await topupService.completeCheckoutTopup({
        tenantId,
        orderReference: walletTopupRef,
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: false });
      expect(nombaApi.verifyTransaction).not.toHaveBeenCalled();
      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('rejects references that do not match the tenant', async () => {
      const { topupService, nombaApi, walletService } = createTopupService();

      const result = await topupService.completeCheckoutTopup({
        tenantId,
        orderReference: 'wt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_ref1',
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: false });
      expect(nombaApi.verifyTransaction).not.toHaveBeenCalled();
      expect(walletService.credit).not.toHaveBeenCalled();
    });
  });
});
