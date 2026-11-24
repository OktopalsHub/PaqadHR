import { WALLET_TOPUP_MAX_AMOUNT } from '../constants/wallet.constants';
import { AssignMemberPointsDto } from './assign-member-points.dto';
import { CreateCustomRewardDto, UpdateCustomRewardDto } from './custom-reward.dto';
import { failedProperties, validationErrors } from './validate-dto.testing';
import { WalletTopupCompleteDto, WalletTopupDto } from './wallet-topup.dto';

const uuid = '3f2b8c1e-6a4d-4c8e-9b1a-2d7e5f0a9c11';

describe('WalletTopupDto', () => {
  it('accepts a valid amount', () => {
    expect(validationErrors(WalletTopupDto, { amount: 5000 })).toHaveLength(0);
  });

  it.each([0, -1, Number.NaN, Infinity, '100', null, WALLET_TOPUP_MAX_AMOUNT + 1])(
    'rejects amount %p',
    (amount) => {
      expect(failedProperties(WalletTopupDto, { amount })).toContain('amount');
    },
  );

  it('rejects unknown fields', () => {
    expect(failedProperties(WalletTopupDto, { amount: 5, tenantId: 'x' })).toContain('tenantId');
  });
});

describe('WalletTopupCompleteDto', () => {
  it('accepts a valid body', () => {
    expect(
      validationErrors(WalletTopupCompleteDto, { orderReference: 'wt_12345678', amount: 10 }),
    ).toHaveLength(0);
  });

  it('rejects missing reference, bad amount and unknown fields', () => {
    expect(failedProperties(WalletTopupCompleteDto, { amount: -1, credited: true })).toEqual(
      expect.arrayContaining(['orderReference', 'amount', 'credited']),
    );
  });
});

describe('Custom reward DTOs', () => {
  it('rejects name/tenantId mass assignment on create', () => {
    expect(
      failedProperties(CreateCustomRewardDto, { title: 'a', pointsCost: 5, tenantId: 'x' }),
    ).toContain('tenantId');
  });

  it('rejects mass assignment and non-positive cost on update', () => {
    expect(
      failedProperties(UpdateCustomRewardDto, { id: 'x', deletedAt: null, pointsCost: 0 }),
    ).toEqual(expect.arrayContaining(['id', 'deletedAt', 'pointsCost']));
  });
});

describe('AssignMemberPointsDto', () => {
  it('accepts valid input', () => {
    expect(
      validationErrors(AssignMemberPointsDto, { memberIds: [uuid], points: 10, reason: 'ok' }),
    ).toHaveLength(0);
  });

  it('rejects negative, huge and unbounded input', () => {
    expect(failedProperties(AssignMemberPointsDto, { memberIds: [uuid], points: -5 })).toContain(
      'points',
    );
    expect(failedProperties(AssignMemberPointsDto, { points: 1e9 })).toContain('points');
    expect(
      failedProperties(AssignMemberPointsDto, { memberIds: Array(1001).fill(uuid), points: 1 }),
    ).toContain('memberIds');
    expect(
      failedProperties(AssignMemberPointsDto, {
        assignments: Array(1001).fill({ memberId: uuid, points: 1 }),
      }),
    ).toContain('assignments');
  });

  it('rejects unknown fields', () => {
    expect(failedProperties(AssignMemberPointsDto, { points: 1, tenantId: 'x' })).toContain(
      'tenantId',
    );
  });
});
