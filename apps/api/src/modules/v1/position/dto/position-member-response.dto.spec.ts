import type { PositionMember } from '../entities/position-member.entity';
import { PositionMemberMapper } from './position-member-response.dto';

const assignment = {
  id: 'a1',
  tenantMemberId: 'm1',
  positionId: 'p1',
  assignedAt: new Date('2024-01-01'),
  isCurrent: true,
  member: {
    id: 'm1',
    firstName: 'Ada',
    lastName: 'Obi',
    phone: '+2348000000000',
    dateOfBirth: new Date('1990-01-01'),
    identityBvn: 'CIPHERBVN',
    identityNin: 'CIPHERNIN',
  },
  position: { id: 'p1', title: 'Engineer', color: '#fff', isActive: true, tenantId: 't1' },
} as unknown as PositionMember;

describe('PositionMemberMapper', () => {
  it('keeps the history shape the client reads', () => {
    expect(PositionMemberMapper.toHistoryEntry(assignment)).toMatchObject({
      id: 'a1',
      tenantMemberId: 'm1',
      positionId: 'p1',
      isCurrent: true,
      position: { id: 'p1', title: 'Engineer', color: '#fff', isActive: true },
    });
  });

  it('never serialises the embedded member in history', () => {
    const json = JSON.stringify(PositionMemberMapper.toHistoryList([assignment]));
    for (const leak of ['CIPHER', 'phone', 'dateOfBirth', 'identity', '"member"', 'tenantId']) {
      expect(json).not.toContain(leak);
    }
  });

  it('embeds only display fields of the member for position rosters', () => {
    const out = PositionMemberMapper.toRosterEntry(assignment);
    expect(out.member).toEqual({ id: 'm1', firstName: 'Ada', lastName: 'Obi' });
    const json = JSON.stringify(out);
    for (const leak of ['CIPHER', 'phone', 'dateOfBirth', 'identity']) {
      expect(json).not.toContain(leak);
    }
  });
});
