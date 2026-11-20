export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export const PASSWORD_MIN_LENGTH_MESSAGE = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
