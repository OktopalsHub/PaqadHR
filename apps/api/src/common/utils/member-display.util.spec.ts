import { formatInviteeDisplayName, formatMemberDisplayName } from './member-display.util';

describe('member-display.util', () => {
  it('formats member display name from preferred name', () => {
    expect(formatMemberDisplayName({ preferredName: 'Dan', firstName: 'Daniel' })).toBe('Dan');
  });

  it('formats member display name from first and last name only', () => {
    expect(formatMemberDisplayName({ firstName: 'Joy', lastName: 'Ibinichina' })).toBe(
      'Joy Ibinichina',
    );
  });

  it('does not fall back to user identity fields', () => {
    expect(formatMemberDisplayName({ firstName: '', lastName: '' })).toBeNull();
  });

  it('formats invitee name from invitation member fields', () => {
    expect(formatInviteeDisplayName({ firstName: 'Joy', lastName: 'Ibinichina' })).toBe(
      'Joy Ibinichina',
    );
  });

  it('falls back when invitee has no tenant member name', () => {
    expect(formatInviteeDisplayName({})).toBe('A team member');
  });
});
