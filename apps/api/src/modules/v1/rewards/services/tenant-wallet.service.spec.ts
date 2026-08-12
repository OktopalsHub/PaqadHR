import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import {
  WALLET_CHARGE_FAILED_ADMIN,
  WALLET_CREDIT_FAILED,
  WALLET_NO_BILLING_CARD,
  WALLET_SAVED_CARD_UNSUPPORTED,
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

    const tenantRecord = { id: tenantId, countryCode: 'NG', preferredCurrency: 'NGN' };
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

  describe('currency lock', () => {
    it('does not sync currency when wallet is funded', async () => {
      const { walletService, walletRepo } = createWalletService({
        wallet: { currencyCode: 'NGN', balanceAmount: 5000 },
      });
      const tenantsService = (walletService as any).tenantsService;
      tenantsService.getTenant.mockResolvedValue({
        id: tenantId,
        countryCode: 'US',
        preferredCurrency: 'USD',
      });

      const wallet = await walletService.getWallet(tenantId);

      expect(wallet.currencyCode).toBe('NGN');
      expect(walletRepo.save).not.toHaveBeenCalled();
    });

    it('keeps NGN for funded NG tenant when preferredCurrency becomes USD', async () => {
      const { walletService, walletRepo } = createWalletService({
        wallet: { currencyCode: 'NGN', balanceAmount: 5000 },
      });
      const tenantsService = (walletService as any).tenantsService;
      tenantsService.getTenant.mockResolvedValue({
        id: tenantId,
        countryCode: 'NG',
        preferredCurrency: 'USD',
      });

      const wallet = await walletService.getWallet(tenantId);

      expect(wallet.currencyCode).toBe('NGN');
      expect(walletRepo.save).not.toHaveBeenCalled();
    });

    it('syncs currency for unfunded wallet when workspace currency changes', async () => {
      const { walletService, walletRepo } = createWalletService({
        wallet: { currencyCode: 'USD', balanceAmount: 0 },
      });
      const tenantsService = (walletService as any).tenantsService;
      tenantsService.getTenant.mockResolvedValue({
        id: tenantId,
        countryCode: 'US',
        preferredCurrency: 'EUR',
      });

      const wallet = await walletService.getWallet(tenantId);

      expect(wallet.currencyCode).toBe('EUR');
      expect(walletRepo.save).toHaveBeenCalled();
    });
  });
});

describe('TenantWalletTopupService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const walletTopupRef = `wt_${tenantId.replace(/-/g, '')}_ref1`;
  const bachsWalletTopupRef = `wb_${tenantId.replace(/-/g, '')}_ref1`;
  const originalNombaClientId = process.env.NOMBA_CLIENT_ID;
  const originalNombaClientSecret = process.env.NOMBA_CLIENT_SECRET;
  const originalNombaAccountId = process.env.NOMBA_PARENT_ACCOUNT_ID;
  const originalNgProvider = process.env.NG_PAYMENTS_PROVIDER;
  const originalNgWalletProvider = process.env.NG_WALLET_PAYMENTS_PROVIDER;
  const originalBachsWalletNgn = process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
  const originalBachsWalletUsd = process.env.BACHS_WALLET_TOPUP_PRODUCT_USD;

  beforeEach(() => {
    process.env.NOMBA_CLIENT_ID = 'client-id';
    process.env.NOMBA_CLIENT_SECRET = 'client-secret';
    process.env.NOMBA_PARENT_ACCOUNT_ID = 'account-id';
    process.env.NG_PAYMENTS_PROVIDER = 'nomba';
    delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    delete process.env.BACHS_WALLET_TOPUP_PRODUCT_USD;
  });

  afterEach(() => {
    process.env.NOMBA_CLIENT_ID = originalNombaClientId;
    process.env.NOMBA_CLIENT_SECRET = originalNombaClientSecret;
    process.env.NOMBA_PARENT_ACCOUNT_ID = originalNombaAccountId;
    if (originalNgProvider === undefined) {
      delete process.env.NG_PAYMENTS_PROVIDER;
    } else {
      process.env.NG_PAYMENTS_PROVIDER = originalNgProvider;
    }
    if (originalNgWalletProvider === undefined) {
      delete process.env.NG_WALLET_PAYMENTS_PROVIDER;
    } else {
      process.env.NG_WALLET_PAYMENTS_PROVIDER = originalNgWalletProvider;
    }
    if (originalBachsWalletNgn === undefined) {
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    } else {
      process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = originalBachsWalletNgn;
    }
    if (originalBachsWalletUsd === undefined) {
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_USD;
    } else {
      process.env.BACHS_WALLET_TOPUP_PRODUCT_USD = originalBachsWalletUsd;
    }
  });

  function createTopupService(overrides?: {
    wallet?: Record<string, unknown>;
    nombaCharge?: jest.Mock;
    nombaVerify?: jest.Mock;
    monnifyVerify?: jest.Mock;
    bachsFindPayment?: jest.Mock;
    paymentMethodId?: string | null;
    tenantCountryCode?: string;
    walletCurrency?: string;
  }) {
    const wallet = {
      id: 'wallet-1',
      tenantId,
      currencyCode: overrides?.walletCurrency ?? 'NGN',
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
      isConfigured: jest.fn().mockReturnValue(true),
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
      findOne: jest.fn().mockResolvedValue({
        id: tenantId,
        name: 'Acme Corp',
        slug: 'acme',
        countryCode: overrides?.tenantCountryCode ?? 'NG',
      }),
    };

    const walletService = {
      ensureWallet: jest.fn().mockResolvedValue(wallet),
      credit: jest.fn().mockResolvedValue(wallet),
    };

    const monnifyApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      initializeTransaction: jest.fn(),
      verifyTransaction:
        overrides?.monnifyVerify ??
        jest.fn().mockResolvedValue({ paid: true, amount: 2500, currency: 'NGN' }),
    };

    const bachsApi = {
      isConfigured: jest.fn().mockReturnValue(true),
      createWalletTopupCheckout: jest.fn().mockResolvedValue({
        checkout_url: 'https://checkout.bachs.io/test',
        checkout_id: 'cs_test',
        reference: 'wb_wallet-topup-ref',
      }),
      findPaymentByReference:
        overrides?.bachsFindPayment ??
        jest.fn().mockResolvedValue({ status: 'succeeded', amount: 2500 }),
    };

    const topupService = new TenantWalletTopupService(
      dataSource as any,
      walletService as any,
      nombaApi as any,
      monnifyApi as any,
      noahApi as any,
      bachsApi as any,
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
      monnifyApi,
      bachsApi,
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

    it('rejects amounts above the configured max', async () => {
      const { topupService, nombaApi } = createTopupService();

      await expect(
        topupService.createTopupCheckout(tenantId, WALLET_TOPUP_MAX_AMOUNT + 1),
      ).rejects.toThrow(`Top up amount cannot exceed ${WALLET_TOPUP_MAX_AMOUNT}`);
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

    it('returns credited false for pending checkout without throwing', async () => {
      const { topupService, walletService, nombaApi } = createTopupService({
        nombaVerify: jest.fn().mockResolvedValue({ status: 'pending', amount: 2500 }),
      });

      const result = await topupService.completeCheckoutTopup({
        tenantId,
        orderReference: walletTopupRef,
        amount: 2500,
      });

      expect(result).toEqual({ received: true, credited: false });
      expect(nombaApi.verifyTransaction).toHaveBeenCalledWith(walletTopupRef);
      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('returns credited false for pending Monnify checkout', async () => {
      const monnifyRef = `wm_${tenantId.replace(/-/g, '')}_abc123`;
      const { topupService, walletService, monnifyApi } = createTopupService({
        monnifyVerify: jest.fn().mockResolvedValue({ paid: false, amount: 2500, currency: 'NGN' }),
      });

      const result = await topupService.completeCheckoutTopup(
        { tenantId, orderReference: monnifyRef, amount: 2500 },
        PaymentProvider.MONNIFY,
      );

      expect(result).toEqual({ received: true, credited: false });
      expect(monnifyApi.verifyTransaction).toHaveBeenCalledWith(monnifyRef);
      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('credits wallet once for a successful Bachs checkout payment', async () => {
      const { topupService, walletService, bachsApi } = createTopupService({
        bachsFindPayment: jest.fn().mockResolvedValue({ status: 'succeeded', amount: 2500 }),
      });

      const result = await topupService.completeCheckoutTopup(
        { tenantId, orderReference: bachsWalletTopupRef, amount: 2500 },
        PaymentProvider.BACHS,
      );

      expect(result).toEqual({ received: true, credited: true });
      expect(bachsApi.findPaymentByReference).toHaveBeenCalledWith(bachsWalletTopupRef);
      expect(walletService.credit).toHaveBeenCalled();
    });
  });

  describe('Bachs checkout', () => {
    const originalBachsKey = process.env.BACHS_SECRET_KEY;

    beforeEach(() => {
      process.env.NG_WALLET_PAYMENTS_PROVIDER = 'bachs';
      process.env.BACHS_SECRET_KEY = 'sk_sandbox_test';
      process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn_wallet';
    });

    afterEach(() => {
      if (originalBachsKey === undefined) {
        delete process.env.BACHS_SECRET_KEY;
      } else {
        process.env.BACHS_SECRET_KEY = originalBachsKey;
      }
    });

    it('creates Bachs checkout with wallet_topup billing meta and ad-hoc amount', async () => {
      const { topupService, bachsApi } = createTopupService();

      const result = await topupService.createTopupCheckout(tenantId, 2500);

      expect(result.checkoutUrl).toBe('https://checkout.bachs.io/test');
      expect(bachsApi.createWalletTopupCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500,
          currency: 'NGN',
          customerEmail: 'billing@test.com',
          metadata: expect.objectContaining({
            tenantId,
            billingType: 'wallet_topup',
            expectedAmount: 2500,
          }),
        }),
      );
      const reference = bachsApi.createWalletTopupCheckout.mock.calls[0][0].reference;
      expect(reference).toMatch(new RegExp(`^wb_${tenantId.replace(/-/g, '')}_`));
    });

    it('rejects manual top-up when provider is Bachs', async () => {
      const { topupService, nombaApi } = createTopupService();

      await expect(topupService.manualTopup(tenantId, 5000)).rejects.toThrow(
        WALLET_SAVED_CARD_UNSUPPORTED,
      );

      expect(nombaApi.chargeTokenizedCard).not.toHaveBeenCalled();
    });
  });

  describe('Monnify saved-card paths', () => {
    const originalNgProvider = process.env.NG_PAYMENTS_PROVIDER;

    beforeEach(() => {
      process.env.NG_PAYMENTS_PROVIDER = 'monnify';
      process.env.MONNIFY_API_KEY = 'key';
      process.env.MONNIFY_SECRET_KEY = 'secret';
      process.env.MONNIFY_CONTRACT_CODE = 'contract';
    });

    afterEach(() => {
      process.env.NG_PAYMENTS_PROVIDER = originalNgProvider;
    });

    it('rejects manual top-up when provider is Monnify', async () => {
      const { topupService, nombaApi, noahApi } = createTopupService();

      await expect(topupService.manualTopup(tenantId, 5000)).rejects.toThrow(
        WALLET_SAVED_CARD_UNSUPPORTED,
      );

      expect(nombaApi.chargeTokenizedCard).not.toHaveBeenCalled();
      expect(noahApi.verifyTransaction).not.toHaveBeenCalled();
    });

    it('skips auto-topup when provider is Monnify', async () => {
      const { topupService, nombaApi } = createTopupService({
        wallet: {
          autoTopupEnabled: true,
          autoTopupThreshold: 1000,
          autoTopupAmount: 5000,
          balanceAmount: 500,
        },
      });

      await topupService.maybeAutoTopupAfterDebit(tenantId);

      expect(nombaApi.chargeTokenizedCard).not.toHaveBeenCalled();
    });
  });
});
