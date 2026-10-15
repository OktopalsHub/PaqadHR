import { StringUtility } from './string.util';

describe('StringUtility.trimAndLowerCase', () => {
  it('lowercases and trims emails', () => {
    expect(StringUtility.trimAndLowerCase('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('StringUtility.generateInviteCode', () => {
  it('returns a 6-character code that fits tenants.invite_code', () => {
    const code = StringUtility.generateInviteCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
