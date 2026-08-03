/** Build before/after maps for activity logs (only keys that actually changed). */
export function pickChangedFields(
  before: Record<string, string>,
  after: Record<string, string>,
): { beforeData: Record<string, string>; afterData: Record<string, string> } {
  const beforeData: Record<string, string> = {};
  const afterData: Record<string, string> = {};
  for (const key of Object.keys(after)) {
    if ((before[key] ?? '') !== (after[key] ?? '')) {
      beforeData[key] = before[key] ?? '—';
      afterData[key] = after[key] ?? '—';
    }
  }
  return { beforeData, afterData };
}

const FIELD_LABELS: Record<string, string> = {
  role: 'role',
  department: 'department',
  reportsTo: 'manager',
  firstName: 'first name',
  lastName: 'last name',
  middleName: 'middle name',
  preferredName: 'preferred name',
  phone: 'phone',
  dateOfBirth: 'date of birth',
  gender: 'gender',
  avatar: 'avatar',
  identityDocuments: 'identity documents',
  status: 'status',
};

/** Human list for activity descriptions, e.g. "role and department". */
export function describeChangedFields(changedKeys: string[]): string {
  const named = changedKeys.map((key) => FIELD_LABELS[key] ?? key);
  if (named.length === 0) return 'details';
  if (named.length === 1) return named[0];
  if (named.length === 2) return `${named[0]} and ${named[1]}`;
  return `${named.slice(0, -1).join(', ')}, and ${named[named.length - 1]}`;
}
