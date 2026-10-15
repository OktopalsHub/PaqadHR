import { extractPayrollFloatTopupCheckout } from '../../webhooks/webhook-request.util';

describe('extractPayrollFloatTopupCheckout', () => {
  it('extracts payroll float top-up and ignores wallet top-up', () => {
    expect(
      extractPayrollFloatTopupCheckout({
        event_type: 'payment_success',
        data: {
          order: {
            orderReference: 'pn_11111111111141118111111111111111_abc',
            amount: 50000,
            orderMetaData: {
              tenantId: '11111111-1111-4111-8111-111111111111',
              billingType: 'payroll_float_topup',
              payrollRunId: '22222222-2222-4222-8222-222222222222',
              expectedAmount: '50000',
              initiatedByMemberId: 'member-1',
            },
          },
        },
      }),
    ).toEqual({
      tenantId: '11111111-1111-4111-8111-111111111111',
      orderReference: 'pn_11111111111141118111111111111111_abc',
      amount: 50000,
      initiatedByMemberId: 'member-1',
      payrollRunId: '22222222-2222-4222-8222-222222222222',
    });

    expect(
      extractPayrollFloatTopupCheckout({
        event_type: 'payment_success',
        data: {
          order: {
            orderReference: 'wt_ref',
            orderMetaData: {
              tenantId: '11111111-1111-4111-8111-111111111111',
              billingType: 'wallet_topup',
            },
          },
        },
      }),
    ).toBeNull();
  });
});
