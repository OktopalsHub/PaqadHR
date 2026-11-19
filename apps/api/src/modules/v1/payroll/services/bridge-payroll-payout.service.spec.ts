import { ServiceUnavailableException } from '@nestjs/common';

import { BridgePayrollPayoutService } from './bridge-payroll-payout.service';

describe('BridgePayrollPayoutService wiring', () => {
  const build = () => {
    const stub = () => ({}) as never;
    return new BridgePayrollPayoutService(
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
      stub(),
    );
  };

  it('exposes the public payout API', () => {
    const service = build();
    for (const method of [
      'assessFundingRequirement',
      'assessRunReadiness',
      'processRun',
      'reconcilePendingTransfers',
      'dispatchTransferWebhook',
    ] as const) {
      expect(typeof service[method]).toBe('function');
    }
  });

  it('routes processRun through the run context collaborator', async () => {
    const service = build();
    await expect(service.processRun({ tenant: {} } as never, [], 'tenant-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
