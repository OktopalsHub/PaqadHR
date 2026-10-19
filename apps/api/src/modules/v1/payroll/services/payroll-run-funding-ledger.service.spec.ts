import { PayrollFundingLedgerEventType } from '../entities/payroll-run-funding-ledger-entry.entity';
import { PayrollRunFundingLedgerService } from './payroll-run-funding-ledger.service';

describe('PayrollRunFundingLedgerService', () => {
  let service: PayrollRunFundingLedgerService;
  let repository: {
    findOne: jest.Mock;
    insert: jest.Mock;
    find: jest.Mock;
  };

  const input = {
    tenantId: 'tenant-1',
    payrollRunId: 'run-1',
    amount: 1250.5,
    currency: 'ngn',
    provider: 'BACHS',
    providerReference: 'checkout-123',
    performedById: 'member-1',
    evidence: { verifiedStatus: 'success', verifiedAmount: 1250.5 },
  };

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      insert: jest.fn(),
      find: jest.fn(),
    };
    service = new PayrollRunFundingLedgerService(repository as never);
  });

  it('records verified funding in the run-scoped ledger', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.insert.mockResolvedValue({ identifiers: [{ id: 'entry-1' }] });

    await service.recordVerifiedFunding(input);

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: input.tenantId,
        payrollRunId: input.payrollRunId,
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: '1250.50',
        currency: 'NGN',
        provider: 'BACHS',
        providerReference: 'checkout-123',
        idempotencyKey: 'funding:checkout-123',
      }),
    );
  });

  it('does not create a duplicate entry for the same verified checkout', async () => {
    repository.findOne.mockResolvedValue({
      tenantId: input.tenantId,
      payrollRunId: input.payrollRunId,
      amount: '1250.50',
      currency: 'NGN',
    });

    await service.recordVerifiedFunding(input);

    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('rejects reusing a checkout reference for another run', async () => {
    repository.findOne.mockResolvedValue({
      tenantId: input.tenantId,
      payrollRunId: 'another-run',
      amount: '1250.50',
      currency: 'NGN',
    });

    await expect(service.recordVerifiedFunding(input)).rejects.toThrow(
      'Funding reference was already allocated to a different payroll transaction',
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('rejects non-positive funding amounts', async () => {
    await expect(service.recordVerifiedFunding({ ...input, amount: 0 })).rejects.toThrow(
      'Verified payroll funding amount must be positive',
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('does not authorize retries from funding credits alone', async () => {
    repository.find.mockResolvedValue([
      {
        eventType: PayrollFundingLedgerEventType.FUNDING_RECEIVED,
        amount: '1250.50',
        currency: 'NGN',
      },
    ]);

    const result = await service.getRunLedger(input.tenantId, input.payrollRunId);

    expect(result.verifiedFundingByCurrency).toEqual({ NGN: 1250.5 });
    expect(result.fundingEvidenceComplete).toBe(false);
    expect(result.retryAuthorization).toBe('blocked');
  });
});
