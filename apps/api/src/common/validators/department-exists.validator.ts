import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { DataSource } from 'typeorm';
import { Department } from '../../modules/v1/departments/entities/department.entity';

@ValidatorConstraint({ name: 'DepartmentExists', async: true })
@Injectable()
export class DepartmentExistsConstraint implements ValidatorConstraintInterface {
  constructor(private dataSource: DataSource) {}

  async validate(departmentId: string): Promise<boolean> {
    if (!departmentId) return false;
    try {
      const department = await this.dataSource
        .getRepository(Department)
        .findOne({ where: { id: departmentId } });
      return !!department;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'Department with the provided ID does not exist';
  }
}

export function DepartmentExists(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: DepartmentExistsConstraint,
    });
  };
}
