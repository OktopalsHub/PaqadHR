import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantMemberRole } from 'src/common/enums';
import { ROLES_KEY, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { PayrollFeeController } from './payroll-fee.controller';

function createContext(options: {
  controllerClass: object;
  handler: (...args: never[]) => unknown;
  role?: string;
}): ExecutionContext {
  return {
    getClass: () => options.controllerClass,
    getHandler: () => options.handler,
    switchToHttp: () => ({
      getRequest: () => ({
        member: { id: 'member-1', role: options.role ?? TenantMemberRole.MEMBER },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('PayrollFeeController authorization', () => {
  const guard = new TenantRoleGuard(new Reflector());
  const controller = new PayrollFeeController({} as never);

  it.each([
    ['preview', controller.previewPayrollFees],
    ['calculate', controller.calculateSingleFee],
  ])('restricts %s to owners and admins', (_name, handler) => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler);

    expect(roles).toEqual([TenantMemberRole.OWNER, TenantMemberRole.ADMIN]);
  });

  it.each([
    ['preview', controller.previewPayrollFees],
    ['calculate', controller.calculateSingleFee],
  ])('denies a plain member access to %s', (_name, handler) => {
    const allowed = guard.canActivate(
      createContext({
        controllerClass: PayrollFeeController,
        handler: handler as (...args: never[]) => unknown,
        role: TenantMemberRole.MEMBER,
      }),
    );

    expect(allowed).toBe(false);
  });

  it.each([
    ['owner', TenantMemberRole.OWNER],
    ['admin', TenantMemberRole.ADMIN],
  ])('allows an %s to reach the fee endpoints', (_name, role) => {
    for (const handler of [controller.previewPayrollFees, controller.calculateSingleFee]) {
      const allowed = guard.canActivate(
        createContext({
          controllerClass: PayrollFeeController,
          handler: handler as (...args: never[]) => unknown,
          role,
        }),
      );

      expect(allowed).toBe(true);
    }
  });
});
