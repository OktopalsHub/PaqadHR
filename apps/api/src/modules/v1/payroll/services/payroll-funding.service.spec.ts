import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import type { Repository } from 'typeorm';

import type { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { Tenant } from '../../tenants/entities/tenant.entity';
import * as payrollDisbursementConfig from '../config/payroll-disbursement.config';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';
import type { PayrollAttemptHistoryService } from './payroll-attempt-history.service';
import { PayrollFeeService } from './payroll-fee.service';
import type { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollFloatTopupCheckoutService } from './payroll-float-topup-checkout.service';
import { PayrollFloatTopupCompletionService } from './payroll-float-topup-completion.service';
import { PayrollFloatTopupRunService } from './payroll-float-topup-run.service';
import { PayrollFundingPreflightService } from './payroll-funding-preflight.service';
import { PayrollFundingService } from './payroll-funding.service';
import type { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

const NOMBA_NGN_ENV = {
  NOMBA_PAYROLL_NGN_ENABLED: 'true',
  PAYROLL_PAYOUT_FEE_NOMBA_NGN: '50',
  NOMBA_CLIENT_ID: 'client',
  NOMBA_CLIENT_SECRET: 'secret',
  NOMBA_PARENT_ACCOUNT_ID: 'account',
};
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const [key, value] of Object.entries(NOMBA_NGN_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterEach(() => {
  for (const key of Object.keys(NOMBA_NGN_ENV)) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const buildFundingService = (
  payrollRunRepository: PayrollRunRepository,
  balanceService: PayrollFloatBalanceService,
  paymentFactory: PaymentProviderFactoryService,
  paymentOrchestrator: PayrollPaymentOrchestrator,
  fundingLedger: PayrollRunFundingLedgerService,
  tenantSettingsService: TenantSettingsService,
  payrollFeeService: PayrollFeeService,
  tenantRepository: Repository<Tenant>,
  bridgePayrollPayout: BridgePayrollPayoutService,
  attemptHistory: PayrollAttemptHistoryService = {
    beginFundingAttempt: jest.fn().mockResolvedValue({}),
    transitionFundingAttempt: jest.fn().mockResolvedValue(null),
    findFundingAttemptByReference: jest.fn().mockResolvedValue(null),
  } as never,
) => {
  const preflightService = new PayrollFundingPreflightService(
    payrollRunRepository,
    balanceService,
    payrollFeeService,
    bridgePayrollPayout,
    tenantRepository,
    tenantSettingsService,
  );
  const floatTopupCheckout = new PayrollFloatTopupCheckoutService(
    balanceService,
    paymentFactory,
    payrollRunRepository,
    preflightService,
    tenantRepository,
    attemptHistory,
  );
  const floatTopupRun = new PayrollFloatTopupRunService(payrollRunRepository, attemptHistory);
  const floatTopupCompletion = new PayrollFloatTopupCompletionService(
    fundingLedger,
    paymentFactory,
    paymentOrchestrator,
    floatTopupRun,
    attemptHistory,
  );
  return new PayrollFundingService(
    payrollRunRepository,
    paymentOrchestrator,
    preflightService,
    floatTopupCheckout,
    floatTopupCompletion,
  );
};

describe('PayrollFundingService.completeFloatTopup', () => {
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
        exists: jest.fn().mockResolvedValue(false),
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

    const tenantRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<Tenant>;

    const service = buildFundingService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      fundingLedger as never,
      tenantSettingsService,
      payrollFeeService as never,
      tenantRepository,
      { assessFundingRequirement: jest.fn() } as never,
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

  it('credits a payment made on a superseded checkout reference', async () => {
    const { service, payrollRunRepository, verifyCheckout, fundingLedger } = createService();
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      createdById: 'member-1',
      metadata: {
        floatTopup: {
          orderReference: 'pf_new',
          status: 'pending',
          shortfall: 1000,
          provider: 'NOMBA',
          references: ['pf_old'],
        },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        getRepository: () => ({
          createQueryBuilder: () => ({
            setLock: () => ({
              where: () => ({ andWhere: () => ({ getOne: async () => run }) }),
            }),
          }),
        }),
        save: async (row: PayrollRun) => row,
      }),
    );
    verifyCheckout.mockResolvedValue({ status: 'succeeded', amount: 1000 });

    const result = await service.completeFloatTopup({
      tenantId: 'tenant-1',
      orderReference: 'pf_old',
      payrollRunId: 'run-1',
      amount: 1000,
    });

    expect(fundingLedger.recordVerifiedFunding).toHaveBeenCalled();
    const stored = (run.metadata as { floatTopup?: { references?: string[] } }).floatTopup;
    expect(stored?.references).toEqual(['pf_new']);
    expect(result.paid).toBe(true);
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

describe('PayrollFundingService.fundAndPay', () => {
  const createFundService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (run: PayrollRun) => run),
      manager: { transaction: jest.fn(), exists: jest.fn().mockResolvedValue(false) },
    } as unknown as PayrollRunRepository;

    const balanceService = {
      supportsHostedFloatTopup: jest.fn().mockReturnValue(true),
      providerDashboardUrl: jest.fn().mockReturnValue('https://dashboard.nomba.com'),
      getAvailableBalance: jest.fn().mockResolvedValue({
        supported: true,
        // No provider float yet, so the company funds the run in full. A funded
        // balance would offset the shortfall and is covered separately.
        available: 0,
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

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'acme', name: 'Acme' }),
    } as unknown as Repository<Tenant>;

    const fundingLedger = {
      recordVerifiedFunding: jest.fn().mockResolvedValue(undefined),
      getRunLedger: jest.fn().mockResolvedValue({ entries: [] }),
    };
    const service = buildFundingService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      fundingLedger as never,
      tenantSettingsService,
      payrollFeeService as never,
      tenantRepository,
      { assessFundingRequirement: jest.fn() } as never,
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
      items: [{ status: 'pending', netAmount: 50_000, paymentCurrency: 'NGN' }],
      metadata: {},
    } as unknown as PayrollRun);
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        getRepository: () => ({ findOne: payrollRunRepository.findOne }),
        save: payrollRunRepository.save,
      }),
    );

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

  it('resumes the open checkout instead of minting a second reference', async () => {
    jest.spyOn(payrollDisbursementConfig, 'isPayrollGatewayEnabled').mockReturnValue(true);
    const { service, createCheckout, payrollRunRepository } = createFundService();
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      status: PayrollStatus.APPROVED,
      baseCurrency: 'NGN',
      totalNetAmount: 50_000,
      items: [{ status: 'pending', netAmount: 50_000, paymentCurrency: 'NGN' }],
      metadata: {
        floatTopup: {
          orderReference: 'pf_open',
          status: 'pending',
          provider: 'NOMBA',
          checkoutRequestedAt: new Date().toISOString(),
          checkoutUrl: 'https://checkout.nomba.com/pay/open',
        },
      },
    } as unknown as PayrollRun;
    (payrollRunRepository.findOne as jest.Mock).mockResolvedValue(run);
    (payrollRunRepository.manager.transaction as jest.Mock).mockImplementation(async (fn) =>
      fn({
        getRepository: () => ({ findOne: payrollRunRepository.findOne }),
        save: payrollRunRepository.save,
      }),
    );

    const outcome = await service.fundAndPay('run-1', 'tenant-1', {
      tenantId: 'tenant-1',
      payrollRunId: 'run-1',
      performedById: 'member-1',
    });

    expect(outcome.action).toBe('checkout');
    if (outcome.action !== 'checkout') return;
    expect(outcome.orderReference).toBe('pf_open');
    expect(outcome.checkoutUrl).toBe('https://checkout.nomba.com/pay/open');
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
