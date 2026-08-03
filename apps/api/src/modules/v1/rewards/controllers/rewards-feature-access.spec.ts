import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import { RewardsController } from './rewards.controller';

function createContext(params: {
  controllerClass: object;
  handler: (...args: never[]) => unknown;
  tenantId?: string;
}): ExecutionContext {
  return {
    getClass: () => params.controllerClass,
    getHandler: () => params.handler,
    switchToHttp: () => ({
      getRequest: () => ({
        params: params.tenantId ? { tenantId: params.tenantId } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('Rewards controller feature access', () => {
  const subscriptionsService = {
    hasFeatureAccess: jest.fn(),
  };
  const guard = new FeatureAccessGuard(new Reflector(), subscriptionsService as never);
  const controller = new RewardsController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['catalog', controller.getCatalog],
    ['wallet', controller.getWallet],
    ['claims', controller.getMyClaims],
    ['custom rewards', controller.listCustomRewards],
    ['airtime operators', controller.listTopupOperators],
  ])('requires integrations for %s', async (_, handler) => {
    subscriptionsService.hasFeatureAccess.mockResolvedValue(false);

    try {
      await guard.canActivate(
        createContext({
          controllerClass: RewardsController,
          handler,
          tenantId: 'tenant-1',
        }),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'FEATURE_NOT_AVAILABLE',
          requiredFeatures: [FeatureAccess.INTEGRATIONS],
        }),
      );
      return;
    }

    throw new Error('Expected integrations access to be denied');
  });

  it.each([
    ['list tasks', controller.listTasks],
    ['list pending submissions', controller.listPendingSubmissions],
    ['create task', controller.createTask],
    ['submit task', controller.submitTask],
    ['approve submission', controller.approveSubmission],
    ['reject submission', controller.rejectSubmission],
    ['assign points', controller.assignPoints],
  ])('keeps %s accessible without integrations feature checks', async (_, handler) => {
    subscriptionsService.hasFeatureAccess.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        createContext({
          controllerClass: RewardsController,
          handler,
          tenantId: 'tenant-1',
        }),
      ),
    ).resolves.toBe(true);

    expect(subscriptionsService.hasFeatureAccess).not.toHaveBeenCalled();
  });
});
