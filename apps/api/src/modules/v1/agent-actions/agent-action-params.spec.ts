import { BadRequestException } from '@nestjs/common';
import { hashAgentActionParams, validateAgentActionParams } from './agent-action-params';

describe('agent-action-params', () => {
  it('accepts empty params for employees.list', () => {
    expect(() => validateAgentActionParams('employees.list', {})).not.toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() => validateAgentActionParams('employees.list', { extra: true })).toThrow(
      BadRequestException,
    );
  });

  it('requires leave.request fields', () => {
    expect(() => validateAgentActionParams('leave.request', {})).toThrow(BadRequestException);
    expect(() =>
      validateAgentActionParams('leave.request', {
        leaveTypeId: 'not-a-uuid',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateAgentActionParams('leave.request', {
        leaveTypeId: '11111111-1111-4111-8111-111111111111',
        startDate: '2026-09-01',
        endDate: '2026-09-05',
      }),
    ).not.toThrow();
  });

  it('hashes params stably regardless of key order', () => {
    const a = hashAgentActionParams({ b: 1, a: 2 });
    const b = hashAgentActionParams({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(hashAgentActionParams({ a: 3, b: 1 })).not.toBe(a);
  });
});
