const BLOCKED_PROPERTY_KEYS = new Set([
  'email',
  'name',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'phone',
  'phoneNumber',
  'phone_number',
  'accountNumber',
  'account_number',
  'bankAccount',
  'bank_account',
  'bvn',
  'nin',
  'salary',
  'amount',
  'payload',
  'body',
  'password',
  'token',
  'authorization',
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  'tenant_id',
  'role',
  'plan',
  'correlation_id',
  'reason',
  'step',
  'stage',
  'provider',
  'feature',
  'platform',
  'ok',
  'type',
  'is_first',
]);

export function sanitizeAnalyticsProperties(
  properties?: Record<string, unknown>,
): Record<string, string | number | boolean> {
  if (!properties) return {};

  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = key.trim();
    const lowerKey = normalizedKey.toLowerCase();

    if (BLOCKED_PROPERTY_KEYS.has(lowerKey) || BLOCKED_PROPERTY_KEYS.has(normalizedKey)) {
      continue;
    }

    if (!ALLOWED_PROPERTY_KEYS.has(lowerKey) && !ALLOWED_PROPERTY_KEYS.has(normalizedKey)) {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[normalizedKey] = value;
    }
  }

  return sanitized;
}
