import { PayrollStatus } from 'src/common/enums/payroll-status.enum';
import type { PaymentProviderFactoryService } from 'src/common/services/payment-provider-factory.service';
import type { Repository } from 'typeorm';
import type { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import type { Tenant } from '../../tenants/entities/tenant.entity';
import type { PayrollRun } from '../entities/payroll-run.entity';
import type { PayrollRunRepository } from '../repositories/payroll-run.repository';
import type { PayrollFloatBalanceService } from './payroll-float-balance.service';
import { PayrollFloatTopupService } from './payroll-float-topup.service';
import type { PayrollPaymentOrchestrator } from './payroll-payment-orchestrator';

describe('PayrollFloatTopupService.completeFloatTopup', () => {
  const createService = () => {
    const payrollRunRepository = {
      findOne: jest.fn(),
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

    const tenantSettingsService = {
      getTenantSettings: jest.fn(),
    } as unknown as TenantSettingsService;

    const tenantRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<Tenant>;

    const service = new PayrollFloatTopupService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      tenantSettingsService,
      tenantRepository,
    );

    return {
      service,
      payrollRunRepository,
      verifyCheckout,
      paymentOrchestrator,
      paymentFactory,
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

    const tenantRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-1', slug: 'acme', name: 'Acme' }),
    } as unknown as Repository<Tenant>;

    const service = new PayrollFloatTopupService(
      payrollRunRepository,
      balanceService,
      paymentFactory,
      paymentOrchestrator,
      tenantSettingsService,
      tenantRepository,
    );

    return { service, paymentOrchestrator, createCheckout, payrollRunRepository };
  };

  it('always opens checkout for full run amount when hosted top-up is supported', async () => {
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
    expect(outcome.preflight.shortfall).toBe(50_000);
    expect(createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50_000, currency: 'NGN' }),
    );
    expect(paymentOrchestrator.payNowPayroll).not.toHaveBeenCalled();
  });
});
