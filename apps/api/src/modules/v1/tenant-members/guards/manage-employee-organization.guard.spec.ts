import { ForbiddenException } from '@nestjs/common';
import { TenantMemberPermission, TenantMemberRole } from 'src/common/enums';
import { ManageEmployeeOrganizationGuard } from './manage-employee-organization.guard';

function contextFor(member: { role: TenantMemberRole; permissions?: string[] }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ member }) }),
  } as never;
}

describe('ManageEmployeeOrganizationGuard', () => {
  const guard = new ManageEmployeeOrganizationGuard();

  it('allows a member with the delegated organization permission', () => {
    expect(
      guard.canActivate(
        contextFor({
          role: TenantMemberRole.MEMBER,
          permissions: [TenantMemberPermission.MANAGE_EMPLOYEE_ORGANIZATION],
        }),
      ),
    ).toBe(true);
  });

  it('rejects a member without the delegated organization permission', () => {
    expect(() => guard.canActivate(contextFor({ role: TenantMemberRole.MEMBER }))).toThrow(
      ForbiddenException,
    );
  });
});
