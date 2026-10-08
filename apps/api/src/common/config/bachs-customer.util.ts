/**
 * Scope a billing email to one Paqad tenant so Bachs customers are never shared
 * across tenants that reuse the same contact address.
 *
 * jane@acme.com + tenant 1111… → jane+paqad111111111111@acme.com
 */
export function scopeBachsCustomerEmail(email: string, tenantId: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return trimmed;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const tag = tenantId.replace(/-/g, '').toLowerCase().slice(0, 12);
  if (!tag) return trimmed;

  // Strip a previous +paqad… tag so retries stay stable.
  const baseLocal = local.replace(/\+paqad[0-9a-f]+$/i, '');
  return `${baseLocal}+paqad${tag}@${domain}`;
}
