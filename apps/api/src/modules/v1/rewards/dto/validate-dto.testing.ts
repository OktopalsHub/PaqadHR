import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validationErrors<T extends object>(cls: ClassConstructor<T>, body: unknown) {
  const instance = plainToInstance(cls, body);
  return validateSync(instance as object, { whitelist: true, forbidNonWhitelisted: true });
}

export function failedProperties<T extends object>(cls: ClassConstructor<T>, body: unknown) {
  return validationErrors(cls, body).map((e) => e.property);
}
