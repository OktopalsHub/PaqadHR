import { NotFoundException } from '@nestjs/common';
import { PaymentProvider } from 'src/common/enums/payment-provider.enum';
import { PayrollItemStatus } from 'src/common/enums/payroll-item-status.enum';
import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import type { Repository } from 'typeorm';
import type { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { Tenant } from '../../tenants/entities/tenant.entity';
import * as payrollDisbursementConfig from '../config/payroll-disbursement.config';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import type { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollFloatTopupService } from './payroll-float-topup.service';
import type { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

describe('PayrollFloatTopupService.completeFloatTopup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    } as unknown as PayrollRunRepository;

    const balanceService = {
      supportsHostedFloatTopup: jest.fn(),
      providerDashboardUrl: jest.fn(),
      getAvailableBalance: jest.fn(),
    } as unknown as PayrollFloatBalanceService;

    const verifyCheckout = jest.fn();
    const paymentFactory = {
      resolveCheckoutAdapter: jest.fn().mockReturnValue({
        isConfigured: () => true,
        verifyCheckout,
      }),
    } as unknown as PaymentProviderFactoryService;

    const paymentOrchestrator = {
      payNowPayroll: jest.fn().mockResolvedValue({ successfulPayments: 1 }),
    } as unknown as PayrollPaymentOrchestrator;

    const fundingLedger = {
      recordVerifiedFunding: jest.fn().mockResolvedValue(undefined),
      getRunLedger: jest.fn().mockResolvedValue({ entries: [] }),
    };

    const tenantSettingsService = {
      getTenantSettings: jest.fn(),
    } as unknown as TenantSettingsService;

    const payrollFeeService = {
      getPayrollFeePercentage: jest.fn().mockResolvedValue(3),
    };

    const bachsApi = {
      createPayoutQuote: jest.fn(),
    };

    const tenantRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<Tenant>;

    const payrollPayoutService = {
      recordConfirmedBachsDebit: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PayrollFloatTopupService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      fundingLedger as never,
      tenantSettingsService,
      payrollFeeService as never,
      bachsApi as never,
      tenantRepository,
      payrollPayoutService as never,
    );

    return {
      service,
      payrollRunRepository,
      verifyCheckout,
      paymentOrchestrator,
      paymentFactory,
      fundingLedger,
    };
  };

  it('rejects null verification and does not pay', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_ref', status: 'pending', shortfall: 1000 },
      },
    } as unknown as PayrollRun);
    verifyCheckout.mockResolvedValue(null);

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_ref',
      payrollRunId: 'run-1',
      amount: 1000,
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('rejects unsuccessful checkout statuses including unsuccessful substring traps', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_ref', status: 'pending', shortfall: 1000 },
      },
    } as unknown as PayrollRun);
    verifyCheckout.mockResolvedValue({ status: 'unsuccessful', amount: 1000 });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_ref',
      payrollRunId: 'run-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('rejects underpayment versus stored shortfall', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_ref', status: 'pending', shortfall: 5000 },
      },
    } as unknown as PayrollRun);
    verifyCheckout.mockResolvedValue({ status: 'success', amount: 1000 });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_ref',
      payrollRunId: 'run-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('rejects when checkout adapter is not configured', async () => {
    const { service, payrollRunRepository, paymentFactory, paymentOrchestrator } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_ref', status: 'pending', shortfall: 1000 },
      },
    } as unknown as PayrollRun);
    (paymentFactory.resolveCheckoutAdapter as jest.Mock).mockReturnValue({
      isConfigured: () => false,
      verifyCheckout: jest.fn(),
    });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_ref',
      payrollRunId: 'run-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('claims completion and auto-pays on successful verification', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_ref', status: 'pending', shortfall: 1000 },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 1000 });
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) => {
      const locked = { ...run };
      const manager = {
        getRepository: () => ({
          createQueryBuilder: () => ({
            setLock: () => ({
              where: () => ({
                andWhere: () => ({
                  getOne: async () => locked,
                }),
              }),
            }),
          }),
        }),
        save: jest.fn(async (entity) => entity),
      };
      return fn(manager);
    });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_ref',
      payrollRunId: 'run-1',
      initiatedByMemberId: 'member-1',
    });

    expect(result).toEqual({ received: true, paid: true });
    expect(paymentOrchestrator.payNowPayroll).toHaveBeenCalledWith(
      'run-1',
      'tenant-1',
      expect.objectContaining({ performedById: 'member-1' }),
    );
  });

  it('records verified retry funding without auto-paying the payroll run', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator, fundingLedger } =
      createService();
    const item = {
      id: 'item-failed',
      status: 'FAILED',
      metadata: {},
    };
    const run = {
      id: 'run-retry',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'USD',
      createdById: 'member-1',
      items: [item],
      metadata: {
        retryFunding: {
          orderReference: 'pb_retry_ref',
          status: 'pending',
          selectedItemIds: ['item-failed'],
          amount: 25,
          currency: 'USD',
          provider: 'BACHS',
          approvedById: 'member-1',
          itemFundingAmounts: { 'item-failed': 25 },
        },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    verifyCheckout.mockResolvedValue({
      status: 'successful',
      amount: 25,
      currency: 'USD',
    });
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) => {
      const locked = { ...run };
      const manager = {
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue(locked),
        }),
        save: jest.fn(async (entity) => entity),
      };
      return fn(manager);
    });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pb_retry_ref',
      payrollRunId: 'run-retry',
      initiatedByMemberId: 'member-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(fundingLedger.recordVerifiedFunding).toHaveBeenCalledWith(
      expect.objectContaining({
        payrollRunId: 'run-retry',
        amount: 25,
        currency: 'USD',
        providerReference: 'pb_retry_ref',
        evidence: expect.objectContaining({
          fundingPurpose: 'approved_retry_shortfall',
          selectedItemIds: 'item-failed',
        }),
      }),
    );
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('ignores a retry checkout completion unless the run has a pending checkout', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } = createService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-retry',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'USD',
      items: [{ id: 'item-failed', status: 'FAILED', metadata: {} }],
      metadata: {
        retryFunding: {
          orderReference: 'pb_retry_ref',
          status: 'approved',
          selectedItemIds: ['item-failed'],
          amount: 25,
          currency: 'USD',
          provider: 'BACHS',
          approvedById: 'member-1',
          itemFundingAmounts: { 'item-failed': 25 },
        },
      },
    } as unknown as PayrollRun);

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pb_retry_ref',
      payrollRunId: 'run-retry',
      initiatedByMemberId: 'member-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(verifyCheckout).not.toHaveBeenCalled();
    expect(fundingLedger.recordVerifiedFunding).not.toHaveBeenCalled();
  });

  it('marks scheduled checkout as funded without paying employees before the scheduled date', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    const run = {
      id: 'run-scheduled',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      payoutMode: 'scheduled',
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: { orderReference: 'pf_scheduled', status: 'pending', shortfall: 1000 },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 1000 });
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) => {
      const locked = { ...run };
      const manager = {
        getRepository: () => ({
          createQueryBuilder: () => ({
            setLock: () => ({
              where: () => ({
                andWhere: () => ({
                  getOne: async () => locked,
                }),
              }),
            }),
          }),
        }),
        save: jest.fn(async (entity) => entity),
      };
      return fn(manager);
    });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_scheduled',
      payrollRunId: 'run-scheduled',
      initiatedByMemberId: 'member-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('does not report a scheduled payroll as paid on duplicate checkout delivery', async () => {
    const { service, payrollRunRepository, verifyCheckout, paymentOrchestrator } = createService();
    const run = {
      id: 'run-scheduled-duplicate',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      payoutMode: 'scheduled',
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: {
          orderReference: 'pf_scheduled_duplicate',
          status: 'pending',
          shortfall: 1000,
        },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 1000 });
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) => {
      const locked = {
        ...run,
        metadata: {
          floatTopup: {
            orderReference: 'pf_scheduled_duplicate',
            status: 'completed',
            shortfall: 1000,
          },
        },
      };
      const manager = {
        getRepository: () => ({
          createQueryBuilder: () => ({
            setLock: () => ({
              where: () => ({
                andWhere: () => ({
                  getOne: async () => locked,
                }),
              }),
            }),
          }),
        }),
        save: jest.fn(async (entity) => entity),
      };
      return fn(manager);
    });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_scheduled_duplicate',
      payrollRunId: 'run-scheduled-duplicate',
      initiatedByMemberId: 'member-1',
    });

    expect(result).toEqual({ received: true, paid: false });
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });
});

describe('PayrollFloatTopupService.fundAndPay', () => {
  const createFundService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (run: PayrollRun) => run),
    } as unknown as PayrollRunRepository;

    const balanceService = {
      supportsHostedFloatTopup: jest.fn().mockReturnValue(true),
      providerDashboardUrl: jest.fn().mockReturnValue('https://dashboard.nomba.com'),
      getAvailableBalance: jest.fn().mockResolvedValue({
        supported: true,
        available: 10_000_000,
      }),
    } as unknown as PayrollFloatBalanceService;

    const createCheckout = jest.fn().mockResolvedValue({
      checkoutLink: 'https://checkout.nomba.com/pay',
      orderReference: 'pf_new',
    });
    const paymentFactory = {
      resolveCheckoutAdapter: jest.fn().mockReturnValue({
        isConfigured: () => true,
        createCheckout,
      }),
    } as unknown as PaymentProviderFactoryService;

    const paymentOrchestrator = {
      payNowPayroll: jest.fn().mockResolvedValue({ successfulPayments: 1 }),
    } as unknown as PayrollPaymentOrchestrator;

    const tenantSettingsService = {
      getTenantSettings: jest.fn().mockResolvedValue({
        settings: { billing: { contactEmail: 'billing@paqad.test' } },
      }),
    } as unknown as TenantSettingsService;

    const payrollFeeService = {
      getPayrollFeePercentage: jest.fn().mockResolvedValue(3),
    };

    const bachsApi = {
      createPayoutQuote: jest.fn(),
    };

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'acme', name: 'Acme' }),
    } as unknown as Repository<Tenant>;

    const fundingLedger = {
      recordVerifiedFunding: jest.fn().mockResolvedValue(undefined),
      getRunLedger: jest.fn().mockResolvedValue({ entries: [] }),
    };
    const service = new PayrollFloatTopupService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      fundingLedger as never,
      tenantSettingsService,
      payrollFeeService as never,
      bachsApi as never,
      tenantRepository,
      { recordConfirmedBachsDebit: jest.fn() } as never,
    );

    return { service, paymentOrchestrator, createCheckout, payrollRunRepository };
  };

  it('opens checkout for the full run amount including platform and payout fees', async () => {
    jest.spyOn(payrollDisbursementConfig, 'isPayrollGatewayEnabled').mockReturnValue(true);
    const { service, paymentOrchestrator, createCheckout, payrollRunRepository } =
      createFundService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      totalNetAmount: 50_000,
      items: [{ status: 'pending', netAmount: 50_000 }],
      metadata: {},
    } as unknown as PayrollRun);

    const outcome = await service.fundAndPay('run-1', 'tenant-1', {
      tenantId: 'tenant-1',
      payrollRunId: 'run-1',
      performedById: 'member-1',
    });

    expect(outcome.action).toBe('checkout');
    if (outcome.action !== 'checkout') return;
    expect(outcome.checkoutUrl).toBe('https://checkout.nomba.com/pay');
    // Checkout must cover employee net pay plus the 3% PaqadHR fee and payout-fee reserve.
    expect(outcome.preflight.shortfall).toBe(51_600);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 51_600,
        currency: 'NGN',
        savePaymentMethod: false,
      }),
    );
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });
});

describe('PayrollFloatTopupService retry funding verification and reuse guards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const retryRun = (
    status: 'pending' | 'funded' | undefined,
    overrides: Record<string, unknown> = {},
    items: Array<Record<string, unknown>> = [],
  ) =>
    ({
      id: 'run-retry',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'USD',
      processingLockedAt: null,
      items,
      metadata: {
        retryFunding: status
          ? {
              orderReference: 'pb_retry_ref',
              status,
              selectedItemIds: ['item-failed'],
              amount: 25,
              currency: 'USD',
              provider: 'BACHS',
              approvedById: 'member-1',
              itemFundingAmounts: { 'item-failed': 25 },
            }
          : undefined,
        ...overrides,
      },
    }) as unknown as PayrollRun;

  const createReconcileService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
      manager: { transaction: jest.fn() },
    } as unknown as PayrollRunRepository;

    const verifyCheckout = jest.fn();
    const paymentFactory = {
      resolveCheckoutAdapter: jest.fn().mockReturnValue({
        isConfigured: () => true,
        verifyCheckout,
      }),
    } as unknown as PaymentProviderFactoryService;

    const fundingLedger = {
      recordVerifiedFunding: jest.fn().mockResolvedValue(undefined),
      getRunLedger: jest.fn().mockResolvedValue({ entries: [] }),
    };

    const payrollPayoutService = {
      recordConfirmedBachsDebit: jest.fn().mockResolvedValue(undefined),
    };

    const balanceService = {
      supportsHostedFloatTopup: jest.fn().mockReturnValue(true),
      providerDashboardUrl: jest.fn().mockReturnValue(''),
      getAvailableBalance: jest.fn().mockResolvedValue({ supported: false }),
    };

    const service = new PayrollFloatTopupService(
      payrollRunRepository,
      balanceService as never,
      paymentFactory,
      {} as never,
      fundingLedger as never,
      {} as never,
      { getPayrollFeePercentage: jest.fn().mockResolvedValue(3) } as never,
      {} as never,
      {} as never,
      payrollPayoutService as never,
    );

    return {
      service,
      payrollRunRepository,
      verifyCheckout,
      fundingLedger,
      payrollPayoutService,
      balanceService,
    };
  };

  const mockFundingTransaction = (
    payrollRunRepository: PayrollRunRepository,
    run: PayrollRun,
  ): PayrollRun => {
    // The service mutates the locked row and saves it, so tests can assert the new metadata.
    const retryMeta = (run.metadata as Record<string, unknown> | null)?.retryFunding as
      | Record<string, unknown>
      | undefined;
    const locked = {
      ...run,
      metadata: { ...run.metadata, retryFunding: { ...retryMeta } },
    } as unknown as PayrollRun;
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        getRepository: () => ({ findOne: jest.fn().mockResolvedValue(locked) }),
        save: jest.fn(async (entity) => entity),
      }),
    );
    return locked;
  };

  it('verifies a paid checkout, credits the ledger, and marks the funding funded', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } =
      createReconcileService();
    const run = retryRun('pending');
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    const locked = mockFundingTransaction(payrollRunRepository, run);
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 25, currency: 'USD' });

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1', 'member-1');

    expect(result).toEqual({
      status: 'funded',
      orderReference: 'pb_retry_ref',
      amount: 25,
      currency: 'USD',
    });
    expect(fundingLedger.recordVerifiedFunding).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        payrollRunId: 'run-retry',
        amount: 25,
        currency: 'USD',
        provider: 'bachs',
        providerReference: 'pb_retry_ref',
        performedById: 'member-1',
        evidence: expect.objectContaining({
          fundingPurpose: 'approved_retry_shortfall',
          selectedItemIds: 'item-failed',
        }),
      }),
    );
    expect(
      (locked.metadata as { retryFunding?: { status?: string; fundedAt?: string } }).retryFunding,
    ).toMatchObject({ status: 'funded' });
  });

  it('credits the provider balance portion when checkout only covers the shortfall', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } =
      createReconcileService();
    const run = retryRun('pending', {
      retryFunding: {
        orderReference: 'pb_retry_ref',
        status: 'pending',
        selectedItemIds: ['item-failed'],
        amount: 1555,
        checkoutAmount: 80.94,
        balanceApplied: 1474.06,
        currency: 'NGN',
        provider: 'BACHS',
        approvedById: 'member-1',
        itemFundingAmounts: { 'item-failed': 1555 },
      },
    });
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    mockFundingTransaction(payrollRunRepository, run);
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 80.94, currency: 'NGN' });

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1', 'member-1');

    expect(result).toEqual({
      status: 'funded',
      orderReference: 'pb_retry_ref',
      amount: 1555,
      currency: 'NGN',
    });
    expect(fundingLedger.recordVerifiedFunding).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1555,
        currency: 'NGN',
        evidence: expect.objectContaining({
          fundingPurpose: 'approved_retry_shortfall',
          checkoutAmount: 80.94,
          balanceApplied: 1474.06,
        }),
      }),
    );
  });

  it('charges only the shortfall when the provider balance already holds part of the retry', async () => {
    jest.spyOn(payrollDisbursementConfig, 'isPayrollGatewayEnabled').mockReturnValue(true);
    process.env.BACHS_SECRET_KEY = 'sk_test';
    process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn';
    try {
      const { service, payrollRunRepository, balanceService } = createReconcileService();
      (payrollRunRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'run-retry',
        tenantId: 'tenant-1',
        status: PayrollStatus.APPROVED,
        baseCurrency: 'NGN',
        processingLockedAt: null,
        items: [
          {
            id: 'item-failed',
            status: PayrollItemStatus.FAILED,
            netAmount: 1500,
            paymentAmount: 1500,
            paymentCurrency: 'NGN',
            paymentProvider: 'bachs',
            metadata: {},
          },
        ],
        metadata: {},
      } as unknown as PayrollRun);
      (balanceService.getAvailableBalance as jest.Mock).mockResolvedValue({
        supported: true,
        available: 1474.06,
      });

      const preview = await service.previewRetryShortfall('run-retry', 'tenant-1', ['item-failed']);

      // ₦1,500 payout + the ₦55 NGN payout-fee reserve (₦50 + 10% markup) = ₦1,555 needed;
      // ₦1,474.06 is already in the Bachs float, so the company only tops up ₦80.94.
      expect(preview.requiredAmount).toBe(1555);
      expect(preview.availableBalance).toBe(1474.06);
      expect(preview.balanceApplied).toBe(1474.06);
      expect(preview.amount).toBe(80.94);
    } finally {
      delete process.env.BACHS_SECRET_KEY;
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    }
  });

  it('stays pending and credits nothing while the provider has not confirmed payment', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } =
      createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(retryRun('pending'));
    verifyCheckout.mockResolvedValue({ status: 'pending', amount: 25, currency: 'USD' });

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1', 'member-1');

    expect(result).toEqual({
      status: 'pending',
      orderReference: 'pb_retry_ref',
      reason: 'provider_payment_not_successful',
    });
    expect(fundingLedger.recordVerifiedFunding).not.toHaveBeenCalled();
    expect(payrollRunRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('does not credit an underpaid checkout', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } =
      createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(retryRun('pending'));
    verifyCheckout.mockResolvedValue({ status: 'successful', amount: 20, currency: 'USD' });

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1', 'member-1');

    expect(result).toEqual({
      status: 'pending',
      orderReference: 'pb_retry_ref',
      reason: 'checkout_underpaid',
    });
    expect(fundingLedger.recordVerifiedFunding).not.toHaveBeenCalled();
  });

  it('reports an already-funded checkout without calling the provider again', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } =
      createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(retryRun('funded'));

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1');

    expect(result).toEqual({
      status: 'funded',
      orderReference: 'pb_retry_ref',
      amount: 25,
      currency: 'USD',
    });
    expect(verifyCheckout).not.toHaveBeenCalled();
    expect(fundingLedger.recordVerifiedFunding).not.toHaveBeenCalled();
  });

  it('reports unavailable when the run has no pending or funded retry checkout', async () => {
    const { service, payrollRunRepository, verifyCheckout } = createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(retryRun(undefined));

    const result = await service.reconcileRetryFunding('run-retry', 'tenant-1');

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'no_pending_retry_funding_checkout',
    });
    expect(verifyCheckout).not.toHaveBeenCalled();
  });

  it('rejects an unknown payroll run', async () => {
    const { service, payrollRunRepository } = createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.reconcileRetryFunding('run-x', 'tenant-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses to fund payouts that verified retry funding already covers', async () => {
    const { service, payrollRunRepository } = createReconcileService();
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(
      retryRun('funded', {}, [{ id: 'item-failed', status: 'failed' }]),
    );

    await expect(
      service.previewRetryShortfall('run-retry', 'tenant-1', ['item-failed']),
    ).rejects.toThrow(/already covered by verified retry funding/);
  });

  describe('a run whose paid item has no booked provider debit', () => {
    const underfundedRun = () =>
      ({
        id: 'run-1',
        tenantId: 'tenant-1',
        status: PayrollStatus.APPROVED,
        baseCurrency: 'NGN',
        processingLockedAt: null,
        items: [
          {
            id: 'item-paid',
            status: 'paid',
            transactionId: 'bachs-payout-1',
            paymentAmount: 2560,
            netAmount: 2560,
            paymentCurrency: 'NGN',
            paymentProvider: 'bachs',
            metadata: {},
          },
          {
            id: 'item-failed',
            status: 'failed',
            transactionId: null,
            paymentAmount: 2560,
            netAmount: 2560,
            paymentCurrency: 'NGN',
            paymentProvider: 'bachs',
            metadata: { payoutNeverSubmitted: true },
          },
        ],
        metadata: {
          floatTopup: {
            orderReference: 'pf_ref',
            status: 'completed',
            provider: 'bachs',
            fundingCurrency: 'NGN',
          },
        },
      }) as unknown as PayrollRun;

    beforeEach(() => {
      jest.spyOn(payrollDisbursementConfig, 'isPayrollGatewayEnabled').mockReturnValue(true);
      process.env.BACHS_SECRET_KEY = 'sk_test';
      process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN = 'prod_ngn';
    });

    afterEach(() => {
      delete process.env.BACHS_SECRET_KEY;
      delete process.env.BACHS_WALLET_TOPUP_PRODUCT_NGN;
    });

    it('asks the provider to confirm the missing debit and then funds the retry', async () => {
      const { service, payrollRunRepository, fundingLedger, payrollPayoutService } =
        createReconcileService();
      (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(underfundedRun());

      const ledgerEntries: Array<Record<string, unknown>> = [];
      (fundingLedger.getRunLedger as jest.Mock).mockImplementation(async () => ({
        entries: ledgerEntries,
      }));
      (payrollPayoutService.recordConfirmedBachsDebit as jest.Mock).mockImplementation(
        async (input: { payrollItemId: string; transactionId: string }) => {
          ledgerEntries.push({
            eventType: 'payout_confirmed',
            payrollItemId: input.payrollItemId,
            amount: '2560.00',
            currency: 'NGN',
            provider: 'bachs',
            providerReference: input.transactionId,
            idempotencyKey: `payout:bachs:${input.transactionId}`,
            evidence: null,
          });
        },
      );

      const preview = await service.previewRetryShortfall('run-1', 'tenant-1', ['item-failed']);

      expect(payrollPayoutService.recordConfirmedBachsDebit).toHaveBeenCalledWith(
        expect.objectContaining({
          payrollRunId: 'run-1',
          payrollItemId: 'item-paid',
          transactionId: 'bachs-payout-1',
        }),
      );
      // The company funds the failed payout and its provider fees, never the platform fee again.
      expect(preview.platformFee).toBe(0);
      expect(preview.amount).toBeGreaterThan(2560);
      expect(preview.selectedItemIds).toEqual(['item-failed']);
    });

    it('keeps the run closed while the provider cannot confirm the debit', async () => {
      const { service, payrollRunRepository } = createReconcileService();
      (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(underfundedRun());

      await expect(
        service.previewRetryShortfall('run-1', 'tenant-1', ['item-failed']),
      ).rejects.toThrow(/Reconcile all paid payroll items/);
    });
  });

  it('allows retrying a subset of a funded selection of failed payouts', async () => {
    const { service, payrollRunRepository } = createReconcileService();
    const run = retryRun(
      undefined,
      {
        retryFunding: {
          orderReference: 'pb_retry_ref',
          status: 'funded',
          selectedItemIds: ['item-failed', 'item-payer'],
          amount: 50,
          currency: 'USD',
          provider: 'BACHS',
          approvedById: 'member-1',
          itemFundingAmounts: { 'item-failed': 25, 'item-payer': 25 },
        },
      },
      [
        { id: 'item-failed', status: PayrollItemStatus.FAILED },
        { id: 'item-payer', status: PayrollItemStatus.PAID },
        { id: 'item-unfunded', status: PayrollItemStatus.FAILED },
      ],
    );
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    jest.spyOn(service, 'preflight').mockResolvedValue({
      provider: PaymentProvider.BACHS,
    } as never);

    // Only the payout that failed again is retried, even though funding covered both.
    await expect(
      service.assertRetryFundedOrThrow('run-retry', 'tenant-1', ['item-failed']),
    ).resolves.toBeUndefined();
    // A payout that already succeeded cannot be retried.
    await expect(
      service.assertRetryFundedOrThrow('run-retry', 'tenant-1', ['item-payer']),
    ).rejects.toThrow(/Only payouts that are still failed/);
    // A failed payout outside the funded selection needs a new approval.
    await expect(
      service.assertRetryFundedOrThrow('run-retry', 'tenant-1', ['item-unfunded']),
    ).rejects.toThrow(/are not covered by this run's verified funding/);
  });
});
