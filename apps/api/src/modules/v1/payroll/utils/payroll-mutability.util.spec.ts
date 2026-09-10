import { ConflictException } from '@nestjs/common';
import { PayrollItemStatus } from '../../../../common/enums/payroll-item-status.enum';
import { PayrollStatus } from '../../../../common/enums/payroll-status.enum';
import type { PayrollRun } from '../entities/payroll-run.entity';
import {
  assertPayrollRunDeletable,
  assertPayrollRunReopenable,
  assertPayrollRunTitleEditable,
} from './payroll-mutability.util';

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

describe('assertPayrollRunReopenable', () => {
  it('allows reopening processing runs without paid items', () => {
    expect(() =>
      assertPayrollRunReopenable(
        draftRun(
          [{ status: PayrollItemStatus.PENDING } as PayrollRun['items'][number]],
          PayrollStatus.PROCESSING,
        ),
      ),
    ).not.toThrow();
  });

  it('blocks draft runs', () => {
    expect(() => assertPayrollRunReopenable(draftRun([], PayrollStatus.DRAFT))).toThrow(
      ConflictException,
    );
  });

  it('blocks processing runs with paid items', () => {
    expect(() =>
      assertPayrollRunReopenable(
        draftRun(
          [{ status: PayrollItemStatus.PAID } as PayrollRun['items'][number]],
          PayrollStatus.PROCESSING,
        ),
      ),
    ).toThrow(ConflictException);
  });
});

describe('assertPayrollRunTitleEditable', () => {
  it('allows draft and processing', () => {
    expect(() => assertPayrollRunTitleEditable(draftRun([], PayrollStatus.DRAFT))).not.toThrow();
    expect(() =>
      assertPayrollRunTitleEditable(draftRun([], PayrollStatus.PROCESSING)),
    ).not.toThrow();
  });

  it('blocks approved and completed', () => {
    expect(() => assertPayrollRunTitleEditable(draftRun([], PayrollStatus.APPROVED))).toThrow(
      ConflictException,
    );
    expect(() => assertPayrollRunTitleEditable(draftRun([], PayrollStatus.COMPLETED))).toThrow(
      ConflictException,
    );
  });
});
