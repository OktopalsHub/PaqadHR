import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

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
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    switch (frequency) {
      case 'weekly':
        return diffDays >= 6 && diffDays <= 8;
      case 'biweekly':
        return diffDays >= 13 && diffDays <= 15;
      case 'monthly':
        return diffDays >= 28 && diffDays <= 32;
      case 'quarterly':
        return diffDays >= 89 && diffDays <= 93;
      case 'annually':
        return diffDays >= 364 && diffDays <= 366;
      default:
        return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const frequency = (args.object as Record<string, unknown>).frequency;
    return `Period length is invalid for ${frequency} frequency`;
  }
}

export function IsNotFuture(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotFutureConstraint,
    });
  };
}

export function IsAfterStartDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
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
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPayrollPeriodConstraint,
    });
  };
}
