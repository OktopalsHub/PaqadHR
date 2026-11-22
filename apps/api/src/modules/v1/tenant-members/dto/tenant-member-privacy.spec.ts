import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import type { TenantMember } from '../entities/tenant-member.entity';
import { TenantMemberMapper } from './tenant-member-response.dto';
import { UpdateMemberProfileDto } from './update-member-profile.dto';

const member = (id: string) =>
  ({
    id,
    phone: '080',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    role: 'member',
    isActive: true,
    tenantId: 't',
    userId: 'u',
    user: { id: 'u', email: 'a@b.c' },
  }) as unknown as TenantMember;

describe('member list privacy', () => {
  it('hides personal fields from non-admins except their own row', () => {
    const [self, other] = TenantMemberMapper.toResponseList([member('a'), member('b')], undefined, {
      viewerId: 'a',
      viewerIsAdmin: false,
    });
    expect(self.phone).toBe('080');
    expect(other.phone).toBeUndefined();
    expect(other.dateOfBirth).toBeUndefined();
    expect(other.gender).toBeUndefined();
  });

  it('shows everything to admins', () => {
    const [row] = TenantMemberMapper.toResponseList([member('b')], undefined, {
      viewerId: 'a',
      viewerIsAdmin: true,
    });
    expect(row.phone).toBe('080');
  });
});

describe('avatarKey validation', () => {
  const check = async (avatarKey: string) =>
    (await validate(plainToInstance(UpdateMemberProfileDto, { avatarKey }))).length;

  it('accepts a bare file name', async () => {
    expect(await check('avatar_1731668445123.jpg')).toBe(0);
  });

  it.each(['../x.jpg', 'tenants/other/employees-avatar/a.jpg', '/etc/passwd', 'a..b.jpg'])(
    'rejects %s',
    async (key) => {
      expect(await check(key)).toBeGreaterThan(0);
    },
  );
});
