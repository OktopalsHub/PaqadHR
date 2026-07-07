import { Transform } from 'class-transformer';
import { StringUtility } from '../utils';

export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? StringUtility.trimAndLowerCase(value) : value,
  );
}
