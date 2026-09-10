/** Build a Fincra-safe customer.full name (needs at least two words). */
export function resolveCheckoutCustomerFullName(
  tenantName: string | null | undefined,
  customerEmail: string,
): string {
  const fromTenant = (tenantName ?? '').trim().replace(/\s+/g, ' ');
  if (fromTenant.includes(' ')) {
    return fromTenant.slice(0, 120);
  }
  if (fromTenant) {
    return `${fromTenant} Workspace`.slice(0, 120);
  }

  const local = (customerEmail.split('@')[0] ?? '')
    .replace(/[._+-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const parts = local.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 4).join(' ').slice(0, 120);
  }
  return `${parts[0] || 'Customer'} Account`.slice(0, 120);
}
