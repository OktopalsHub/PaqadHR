import { PayrollCalculationService } from './payroll-calculation.service';

describe('PayrollCalculationService', () => {
  it('constructs with its DI dependencies', () => {
    const service = new PayrollCalculationService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(service).toBeInstanceOf(PayrollCalculationService);
  });
});
