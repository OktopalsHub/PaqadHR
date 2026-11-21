import 'reflect-metadata';

import { validate } from 'class-validator';

import { TenantMemberRole } from '../../../../common/enums/tenant-member.enum';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { UpdateInvitationDto } from '../dto/update-invitation.dto';
import { resolveInvitedMemberRole } from './invitation-role.util';

const base = { firstName: 'A', lastName: 'B', email: 'a@b.com' };

async function roleErrors(Dto: typeof CreateInvitationDto | typeof UpdateInvitationDto, role: string) {
  const dto = Object.assign(new Dto(), { ...base, role });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.filter((e) => e.property === 'role');
}

describe('invitation role', () => {
  it.each(['super_admin', 'admin_platform', 'owner', 'Employee', ''])(
    'rejects %p on create',
    async (role) => {
      expect(await roleErrors(CreateInvitationDto, role)).not.toHaveLength(0);
    },
  );

  it.each(['member', 'admin'])('accepts %p on create', async (role) => {
    expect(await roleErrors(CreateInvitationDto, role)).toHaveLength(0);
  });

  it('rejects super_admin on update', async () => {
    expect(await roleErrors(UpdateInvitationDto, 'super_admin')).not.toHaveLength(0);
  });

  it('resolves only member or admin, never owner or free text', () => {
    expect(resolveInvitedMemberRole('admin')).toBe(TenantMemberRole.ADMIN);
    expect(resolveInvitedMemberRole('member')).toBe(TenantMemberRole.MEMBER);
    expect(resolveInvitedMemberRole('owner')).toBe(TenantMemberRole.MEMBER);
    expect(resolveInvitedMemberRole('super_admin')).toBe(TenantMemberRole.MEMBER);
    expect(resolveInvitedMemberRole('Employee')).toBe(TenantMemberRole.MEMBER);
  });
});
