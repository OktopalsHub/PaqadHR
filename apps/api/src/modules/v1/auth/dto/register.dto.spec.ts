import { validateSync } from 'class-validator';
import { PASSWORD_MIN_LENGTH_MESSAGE } from 'src/common/constants/password-policy.constant';

import { RegisterDto } from './register.dto';

function registerDto(password: string, termsAccepted = true): RegisterDto {
  return Object.assign(new RegisterDto(), {
    email: 'user@example.com',
    password,
    termsAccepted,
  });
}

describe('RegisterDto password policy', () => {
  it('accepts any password with at least 8 characters', () => {
    expect(validateSync(registerDto('password'))).toHaveLength(0);
  });

  it('rejects a password shorter than 8 characters', () => {
    const errors = validateSync(registerDto('short'));
    const passwordError = errors.find((error) => error.property === 'password');

    expect(passwordError?.constraints?.minLength).toBe(PASSWORD_MIN_LENGTH_MESSAGE);
  });

  it('rejects registration without terms acceptance', () => {
    const errors = validateSync(registerDto('password', false));
    const termsError = errors.find((error) => error.property === 'termsAccepted');

    expect(termsError?.constraints?.equals).toBe(
      'You must accept the terms and privacy policy to register',
    );
  });
});
