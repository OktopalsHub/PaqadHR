import { RATE_LIMIT_KEY, RateLimitPresets } from 'src/common/decorators';
import { PayrollRunsController } from './payroll-runs.controller';

describe('PayrollRunsController rate limiting', () => {
  const controller = new PayrollRunsController({} as never, {} as never);

  it.each([
    ['create run', controller.createPayrollRun],
    ['calculate', controller.calculatePayroll],
    ['calculate with adjustments', controller.calculatePayrollWithAdjustments],
    ['approve', controller.approvePayrollRun],
    ['process', controller.processPayroll],
    ['reopen', controller.reopenPayrollRun],
    ['update', controller.patchPayrollRun],
    ['delete', controller.deletePayrollRun],
    ['notify payment setup', controller.notifyMemberPaymentSetup],
  ])('rate limits the %s endpoint', (_name, handler) => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler)).toEqual(RateLimitPresets.SENSITIVE);
  });

  it.each([
    ['list runs', controller.getPayrollRuns],
    ['get run', controller.getPayrollRun],
    ['readiness', controller.getPayrollReadiness],
    ['audit trail', controller.getAuditTrail],
  ])('leaves the read-only %s endpoint unthrottled', (_name, handler) => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler)).toBeUndefined();
  });
});
