import { BadRequestException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService scope normalization', () => {
  const service = new ApiKeysService({} as never);

  it('rejects unknown scopes', () => {
    expect(() =>
      (service as unknown as { normalizeScopes(scopes: string[]): string[] }).normalizeScopes([
        'invalid:scope',
      ]),
    ).toThrow(BadRequestException);
  });

  it('requires agent:actions when payroll:write is requested', () => {
    expect(() =>
      (service as unknown as { normalizeScopes(scopes: string[]): string[] }).normalizeScopes([
        'payroll:write',
        'employees:read',
      ]),
    ).toThrow(BadRequestException);
  });

  it('accepts payroll:write when agent:actions is explicit', () => {
    const scopes = (
      service as unknown as { normalizeScopes(scopes: string[]): string[] }
    ).normalizeScopes(['payroll:write', 'agent:actions']);

    expect(scopes).toContain('agent:actions');
    expect(scopes).toContain('payroll:write');
  });
});
