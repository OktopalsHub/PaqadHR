import type { TenantMember } from '../../tenant-members/entities/tenant-member.entity';
import { DepartmentMemberSummaryMapper } from './department-member-response.dto';

const member = {
  id: 'm1',
  firstName: 'Ada',
  lastName: 'Obi',
  preferredName: 'A',
  role: 'MEMBER',
  isActive: true,
  avatarKey: 'k.png',
  phone: '+2348000000000',
  dateOfBirth: new Date('1990-01-01'),
  identityBvn: 'CIPHERBVN',
  identityNin: 'CIPHERNIN',
} as unknown as TenantMember;

describe('DepartmentMemberSummaryMapper', () => {
  it('returns the display fields', () => {
    expect(DepartmentMemberSummaryMapper.toResponse(member)).toMatchObject({
      id: 'm1',
      firstName: 'Ada',
      lastName: 'Obi',
    });
  });

  it('omits sensitive member columns', () => {
    const json = JSON.stringify(DepartmentMemberSummaryMapper.toResponseList([member]));
    for (const leak of ['CIPHER', 'phone', 'dateOfBirth', 'identity', '+234']) {
      expect(json).not.toContain(leak);
    }
  });
});
