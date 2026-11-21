import { EmploymentStatus, PaySchedule, PayType } from 'src/common/enums';

import type { Employment } from '../entities/employment.entity';
import { EmploymentMapper } from './employment-response.dto';

const buildEmployment = (): Employment =>
  ({
    id: 'e1',
    tenantMemberId: 'm1',
    tenantId: 't1',
    startDate: new Date('2024-01-01'),
    endDate: undefined,
    status: EmploymentStatus.ACTIVE,
    payType: PayType.SALARY,
    paySchedule: PaySchedule.MONTHLY,
    payRate: 5000,
    currency: 'USD',
    comments: 'note',
    positionId: 'p1',
    reportsToId: 'm2',
    createdBy: 'm9',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-03'),
    position: { id: 'p1', title: 'Engineer', color: '#fff', tenantId: 't1', description: 'secret' },
    tenantMember: {
      id: 'm1',
      dateOfBirth: new Date('1990-01-01'),
      phone: '+2348000000000',
      identityBvn: 'CIPHERBVN',
      identityNin: 'CIPHERNIN',
    },
    reportsTo: { id: 'm2', phone: '+2348111111111', identityBvn: 'CIPHERBVN2' },
    creator: { id: 'm9', identityNin: 'CIPHERNIN9' },
  }) as unknown as Employment;

describe('EmploymentMapper', () => {
  it('keeps the fields the client reads', () => {
    const out = EmploymentMapper.toResponse(buildEmployment());
    expect(out).toMatchObject({
      id: 'e1',
      tenantMemberId: 'm1',
      status: EmploymentStatus.ACTIVE,
      payType: PayType.SALARY,
      paySchedule: PaySchedule.MONTHLY,
      payRate: 5000,
      currency: 'USD',
      comments: 'note',
      positionId: 'p1',
      reportsToId: 'm2',
      position: { id: 'p1', title: 'Engineer', color: '#fff' },
    });
  });

  it('never serialises member PII, ciphertext or creator rows', () => {
    const json = JSON.stringify(EmploymentMapper.toResponse(buildEmployment()));
    for (const leak of [
      'CIPHER',
      'dateOfBirth',
      'phone',
      '+234',
      'identity',
      'tenantMember"',
      'creator',
      'createdBy',
      'secret',
    ]) {
      expect(json).not.toContain(leak);
    }
  });

  it('maps lists', () => {
    expect(EmploymentMapper.toResponseList([buildEmployment()])).toHaveLength(1);
  });

  it('tolerates a missing position', () => {
    const e = buildEmployment();
    e.position = null;
    expect(EmploymentMapper.toResponse(e).position).toBeUndefined();
  });
});
