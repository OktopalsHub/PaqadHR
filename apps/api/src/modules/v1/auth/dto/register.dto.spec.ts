import { validateSync } from 'class-validator';
import { STRONG_PASSWORD_MESSAGE } from 'src/common/constants/password-policy.constant';
import { RegisterDto } from './register.dto';

function registerDto(password: string): RegisterDto {
  return Object.assign(new RegisterDto(), {
    email: 'user@example.com',
    password,
  });
}

describe('RegisterDto password policy', () => {
  it('accepts a password that satisfies every rule', () => {
    expect(validateSync(registerDto('StrongPass1!'))).toHaveLength(0);
  });

  it('rejects a password containing whitespace', () => {
    const errors = validateSync(registerDto('Strong Pass1!'));
    const passwordError = errors.find((error) => error.property === 'password');

    expect(passwordError?.constraints?.matches).toBe(STRONG_PASSWORD_MESSAGE);
  });
});
