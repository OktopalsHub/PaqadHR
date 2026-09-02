import { ConflictException } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { PayrollRun } from '../entities/payroll-run.entity';
import { assertPayrollRunDeletable } from './payroll-mutability.util';

function draftRun(items: PayrollRun['items'] = [], status = PayrollStatus.DRAFT): PayrollRun {
  return {
    status,
    items,
  } as unknown as PayrollRun;
}

describe('assertPayrollRunDeletable', () => {
  it('allows deleting draft runs without paid items', () => {
    expect(() =>
      assertPayrollRunDeletable(
        draftRun([{ status: PayrollItemStatus.PENDING } as PayrollRun['items'][number]]),
      ),
    ).not.toThrow();
  });

  it('blocks completed runs', () => {
    expect(() => assertPayrollRunDeletable(draftRun([], PayrollStatus.COMPLETED))).toThrow(
      ConflictException,
    );
  });

  it('blocks runs with paid items', () => {
    expect(() =>
      assertPayrollRunDeletable(
        draftRun([{ status: PayrollItemStatus.PAID } as PayrollRun['items'][number]]),
      ),
    ).toThrow(ConflictException);
  });

  it('blocks runs with processing items', () => {
    expect(() =>
      assertPayrollRunDeletable(
        draftRun([{ status: PayrollItemStatus.PROCESSING } as PayrollRun['items'][number]]),
      ),
    ).toThrow(ConflictException);
  });
});
