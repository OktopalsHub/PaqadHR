import { formatInviteeDisplayName, formatMemberDisplayName } from './member-display.util';

describe('member-display.util', () => {
  it('prefers full legal name over preferred name', () => {
    expect(
      formatMemberDisplayName({ preferredName: 'Dan', firstName: 'Daniel', lastName: 'Mbazu' }),
    ).toBe('Daniel Mbazu');
  });

  it('includes middle name in full display', () => {
    expect(
      formatMemberDisplayName({ firstName: 'Joy', middleName: 'A.', lastName: 'Ibinichina' }),
    ).toBe('Joy A. Ibinichina');
  });

  it('falls back to preferred name when legal name is empty', () => {
    expect(formatMemberDisplayName({ preferredName: 'Dan', firstName: '', lastName: '' })).toBe(
      'Dan',
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
