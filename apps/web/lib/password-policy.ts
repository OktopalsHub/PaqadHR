export const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', matches: (password: string) => password.length >= 8 },
  { label: 'One uppercase letter', matches: (password: string) => /[A-Z]/.test(password) },
  { label: 'One lowercase letter', matches: (password: string) => /[a-z]/.test(password) },
  { label: 'One number', matches: (password: string) => /\d/.test(password) },
  {
    label: 'One special character',
    matches: (password: string) => /[^A-Za-z0-9\s]/.test(password),
  },
] as const;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.matches(password));
}

export const STRONG_PASSWORD_MESSAGE =
  'Use at least 8 characters, with an uppercase letter, lowercase letter, number, and special character.';
