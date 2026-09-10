import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeSchema } from '../schemas/employee';
import { mapTenantMemberToEmployee } from './employee';

test('maps a member without a position or department colour', () => {
  const employee = mapTenantMemberToEmployee({
    id: 'member-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'employee',
    isActive: true,
    user: { email: 'ada@example.com' },
    position: { id: 'position-1', title: 'Engineer' },
  });

  assert.equal(employee.name, 'Ada Lovelace');
  assert.equal(employee.positionColor, undefined);
  assert.equal('positionColor' in employee, false);
  assert.equal('departmentColor' in employee, false);
  assert.doesNotThrow(() => employeeSchema.parse(employee));
});
