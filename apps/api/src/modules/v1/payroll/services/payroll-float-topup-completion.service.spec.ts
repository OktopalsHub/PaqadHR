import { PayrollStatus } from 'src/common/enums/payroll-status.enum';

import { PayrollFloatTopupCompletionService } from './payroll-float-topup-completion.service';

const REF = 'pn_ref_1';
const manager = { tx: true };

const build = (attempt: Record<string, unknown> | null, floatTopup: Record<string, unknown>) => {
  const run = {
    id: 'run-1',
    tenantId: 't1',
    baseCurrency: 'NGN',
    payoutMode: 'immediate',
    status: PayrollStatus.APPROVED,
    createdById: 'admin-1',
    metadata: { floatTopup },
  };
  const calls: string[] = [];
  const fundingLedger = {
    recordVerifiedFunding: jest.fn(async (_i: unknown, m?: unknown) => {
      calls.push(`ledger:${m === manager}`);
    }),
  };
  const attemptHistory = {
    transitionFundingAttempt: jest.fn(async (_i: unknown, m?: unknown) => {
      calls.push(`attempt:${m === manager}`);
      return null;
    }),
  };
  const floatTopupRun = {
    findRunForTopup: jest.fn().mockResolvedValue({ run, attempt }),
    transaction: jest.fn(async (work: (m: unknown) => unknown) => work(manager)),
    claimFloatTopupCompleted: jest.fn(async (_i: unknown, m?: unknown) => {
      calls.push(`claim:${m === manager}`);
      return run;
    }),
  };
  const adapter = {
    isConfigured: () => true,
    verifyCheckout: jest
      .fn()
      .mockResolvedValue({ status: 'success', amount: 1000, currency: 'NGN' }),
  };
  const orchestrator = { payNowPayroll: jest.fn().mockResolvedValue(undefined) };
  const service = new PayrollFloatTopupCompletionService(
    fundingLedger as never,
    { resolveCheckoutAdapter: () => adapter } as never,
    orchestrator as never,
    floatTopupRun as never,
    attemptHistory as never,
  );
  return { service, calls, floatTopupRun, adapter, orchestrator };
};

describe('PayrollFloatTopupCompletionService', () => {
  const pending = { orderReference: REF, status: 'pending', shortfall: 1000, provider: 'nomba' };
  const openAttempt = {
    purpose: 'run_funding',
    status: 'pending',
    provider: 'nomba',
    checkoutAmount: '1000',
    currency: 'NGN',
  };

  it('credits, confirms the attempt and claims the run inside one transaction', async () => {
    const { service, calls, floatTopupRun, orchestrator } = build(openAttempt, pending);
    const result = await service.completeFloatTopup({ tenantId: 't1', orderReference: REF });
    expect(floatTopupRun.transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['ledger:true', 'attempt:true', 'claim:true']);
    expect(orchestrator.payNowPayroll).toHaveBeenCalled();
    expect(result).toEqual({ received: true, paid: true });
  });

  it('rolls everything back together when a write inside the transaction fails', async () => {
    const { service, floatTopupRun, orchestrator } = build(openAttempt, pending);
    floatTopupRun.claimFloatTopupCompleted.mockRejectedValue(new Error('db down'));
    await expect(
      service.completeFloatTopup({ tenantId: 't1', orderReference: REF }),
    ).rejects.toThrow('db down');
    expect(orchestrator.payNowPayroll).not.toHaveBeenCalled();
  });

  it('replays the run claim for an attempt confirmed by the old split-commit flow', async () => {
    const { service, floatTopupRun, adapter, orchestrator } = build(
      { ...openAttempt, status: 'confirmed' },
      pending,
    );
    const result = await service.completeFloatTopup({ tenantId: 't1', orderReference: REF });
    expect(adapter.verifyCheckout).not.toHaveBeenCalled();
    expect(floatTopupRun.claimFloatTopupCompleted).toHaveBeenCalledTimes(1);
    expect(orchestrator.payNowPayroll).toHaveBeenCalled();
    expect(result).toEqual({ received: true, paid: true });
  });

  it('does nothing for a replay once the run is already completed', async () => {
    const { service, floatTopupRun, orchestrator } = build(
      { ...openAttempt, status: 'confirmed' },
      { ...pending, status: 'completed' },
    );
    const result = await service.completeFloatTopup({ tenantId: 't1', orderReference: REF });
    expect(floatTopupRun.claimFloatTopupCompleted).not.toHaveBeenCalled();
    expect(orchestrator.payNowPayroll).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true, paid: true });
  });
});
