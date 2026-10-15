import assert from 'node:assert/strict';
import test from 'node:test';
import { groupEmployeeIdsBySalaryCurrency } from './payroll-create.ts';

test('groupEmployeeIdsBySalaryCurrency groups active employees by salary currency', () => {
  const result = groupEmployeeIdsBySalaryCurrency(
    ['m1', 'm2', 'm3', 'm4'],
    [
      { memberId: 'm1', payRate: 100, payType: 'salary', paySchedule: 'monthly', currency: 'NGN' },
      { memberId: 'm2', payRate: 200, payType: 'salary', paySchedule: 'monthly', currency: 'USD' },
      { memberId: 'm3', payRate: 150, payType: 'salary', paySchedule: 'monthly', currency: 'USD' },
      { memberId: 'm4', payRate: 90, payType: 'salary', paySchedule: 'monthly' },
    ],
    'EUR',
  );

  assert.deepEqual(result, [
    { currency: 'EUR', employeeIds: ['m4'] },
    { currency: 'NGN', employeeIds: ['m1'] },
    { currency: 'USD', employeeIds: ['m2', 'm3'] },
  ]);
});

test('groupEmployeeIdsBySalaryCurrency ignores inactive employees', () => {
  const result = groupEmployeeIdsBySalaryCurrency(
    ['m1'],
    [{ memberId: 'm2', payRate: 100, payType: 'salary', paySchedule: 'monthly', currency: 'NGN' }],
  );
  assert.deepEqual(result, []);
});
