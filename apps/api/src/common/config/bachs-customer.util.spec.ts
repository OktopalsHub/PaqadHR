import { scopeBachsCustomerEmail } from './bachs-customer.util';

describe('scopeBachsCustomerEmail', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  it('adds a tenant tag to the local part', () => {
    expect(scopeBachsCustomerEmail('Jane@Acme.com', tenantId)).toBe(
      'jane+paqad111111111111@acme.com',
    );
  });

  it('is stable when already scoped for the same tenant', () => {
    const once = scopeBachsCustomerEmail('jane@acme.com', tenantId);
    expect(scopeBachsCustomerEmail(once, tenantId)).toBe(once);
  });

  it('re-scopes when the tenant changes', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    const fromA = scopeBachsCustomerEmail('jane@acme.com', tenantId);
    expect(scopeBachsCustomerEmail(fromA, other)).toBe('jane+paqad222222222222@acme.com');
  });
});
