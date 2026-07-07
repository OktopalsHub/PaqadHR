import { StringUtility } from './string.util';

describe('StringUtility.trimAndLowerCase', () => {
  it('lowercases and trims emails', () => {
    expect(StringUtility.trimAndLowerCase('  User@Example.COM ')).toBe('user@example.com');
  });
});
