import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export const PAYROLL_PERIOD_DAY_RANGES = {
  weekly: { min: 6, max: 8, label: 'Weekly' },
  biweekly: { min: 13, max: 15, label: 'Bi-weekly' },
  monthly: { min: 25, max: 32, label: 'Monthly' },
  quarterly: { min: 89, max: 93, label: 'Quarterly' },
  annually: { min: 364, max: 366, label: 'Annually' },
} as const;

export type PayrollFrequency = keyof typeof PAYROLL_PERIOD_DAY_RANGES;

export function payrollPeriodDiffDays(
  periodStart: Date | string,
  periodEnd: Date | string,
): number {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function describePayrollPeriodError(frequency: string, diffDays: number): string | null {
  const range = PAYROLL_PERIOD_DAY_RANGES[frequency as PayrollFrequency];
  if (!range) {
    return 'Select a valid payroll frequency.';
  }

  if (diffDays < range.min) {
    return `${range.label} payroll needs ${range.min}–${range.max} days between period start and end; you have ${diffDays} days.`;
  }
  if (diffDays > range.max) {
    return `${range.label} payroll allows at most ${range.max} days between start and end; you have ${diffDays} days.`;
  }
  return null;
}

@ValidatorConstraint({ name: 'isNotFuture', async: false })
export class IsNotFutureConstraint implements ValidatorConstraintInterface {
  validate(date: unknown) {
    if (!date) return false;
    const inputDate = new Date(date as string);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return inputDate <= today;
  }

  defaultMessage() {
    return 'Date cannot be in the future';
  }
}

@ValidatorConstraint({ name: 'isAfterStartDate', async: false })
export class IsAfterStartDateConstraint implements ValidatorConstraintInterface {
  validate(endDate: unknown, args: ValidationArguments) {
    if (!endDate) return false;
    const startDate = (args.object as Record<string, unknown>)[args.constraints[0]];
    if (!startDate) return false;
    return new Date(endDate as string) > new Date(startDate as string);
  }

  defaultMessage(args: ValidationArguments) {
    return `End date must be after ${args.constraints[0]}`;
  }
}

@ValidatorConstraint({ name: 'isValidPayrollPeriod', async: false })
export class IsValidPayrollPeriodConstraint implements ValidatorConstraintInterface {
  validate(endDate: unknown, args: ValidationArguments) {
    if (!endDate) return false;
    const obj = args.object as Record<string, unknown>;
    const startDate = obj.periodStart;
    const frequency = obj.frequency;
    if (!startDate || !frequency) return false;
    const diffDays = payrollPeriodDiffDays(startDate as string, endDate as string);
    return describePayrollPeriodError(String(frequency), diffDays) === null;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as Record<string, unknown>;
    const startDate = obj.periodStart;
    const frequency = String(obj.frequency ?? '');
    const endDate = args.value;
    if (!startDate || !endDate) {
      return 'Pay period length is invalid for the selected frequency';
    }
    const diffDays = payrollPeriodDiffDays(startDate as string, endDate as string);
    return (
      describePayrollPeriodError(frequency, diffDays) ??
      'Pay period length is invalid for the selected frequency'
    );
  }
}

export function IsNotFuture(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotFutureConstraint,
    });
  };
}

export function IsAfterStartDate(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: IsAfterStartDateConstraint,
    });
  };
}

export function IsValidPayrollPeriod(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPayrollPeriodConstraint,
    });
  };
}
