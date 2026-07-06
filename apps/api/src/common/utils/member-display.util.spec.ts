import { formatInviteeDisplayName, formatMemberDisplayName } from './member-display.util';

describe('member-display.util', () => {
  it('formats member display name from preferred name', () => {
    expect(formatMemberDisplayName({ preferredName: 'Dan', firstName: 'Daniel' })).toBe('Dan');
  });

  it('formats invitee name without email', () => {
    expect(
      formatInviteeDisplayName({
        firstName: 'Joy',
        lastName: 'Ibinichina',
        email: 'ibinichinasajoy@gmail.com',
      }),
    ).toBe('Joy Ibinichina');
  });

  it('falls back when invitee has no name', () => {
    expect(formatInviteeDisplayName({ email: 'ibinichinasajoy@gmail.com' })).toBe('A team member');
  });
});
