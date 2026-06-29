export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'];

export function genderLabel(value?: string | null): string {
  if (!value) return '';
  const match = GENDER_OPTIONS.find((option) => option.value === value.toLowerCase());
  return match?.label ?? value;
}

export function normalizeGender(value?: string | null): GenderValue | '' {
  if (!value) return '';
  const normalized = value.toLowerCase();
  return GENDER_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as GenderValue)
    : '';
}
