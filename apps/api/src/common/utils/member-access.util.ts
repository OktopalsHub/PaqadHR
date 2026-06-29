import { ForbiddenException } from '@nestjs/common';
import { TenantMemberRole } from 'src/common/enums';
import type { MemberContext } from 'src/common/interfaces';

export function isTenantAdmin(member: MemberContext): boolean {
  return member.role === TenantMemberRole.ADMIN || member.role === TenantMemberRole.OWNER;
}

export function assertAdmin(member: MemberContext): void {
  if (!isTenantAdmin(member)) {
    throw new ForbiddenException('Admin access required');
  }
}

export function assertMemberRecordAccess(member: MemberContext, targetMemberId: string): void {
  if (!isTenantAdmin(member) && member.id !== targetMemberId) {
    throw new ForbiddenException('You can only access your own records');
  }
}

export function assertSelfOrAdmin(member: MemberContext, targetMemberId: string): void {
  assertMemberRecordAccess(member, targetMemberId);
}
