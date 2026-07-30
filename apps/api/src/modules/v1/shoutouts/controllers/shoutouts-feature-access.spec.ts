import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { FeatureAccessGuard } from 'src/common/guards/feature-access.guard';
import { ShoutoutCategoriesController } from './shoutout-categories.controller';
import { ShoutoutsController } from './shoutouts.controller';

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

describe('Shoutout controller feature access', () => {
  const subscriptionsService = {
    hasFeatureAccess: jest.fn(),
  };
  const guard = new FeatureAccessGuard(new Reflector(), subscriptionsService as never);
  const categoriesController = new ShoutoutCategoriesController({} as never);
  const shoutoutsController = new ShoutoutsController({} as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['categories:list', ShoutoutCategoriesController, categoriesController.listCategories],
    ['categories:create', ShoutoutCategoriesController, categoriesController.createCategory],
    ['categories:update', ShoutoutCategoriesController, categoriesController.updateCategory],
    ['categories:delete', ShoutoutCategoriesController, categoriesController.deleteCategory],
    ['shoutouts:create', ShoutoutsController, shoutoutsController.createShoutout],
    ['shoutouts:list', ShoutoutsController, shoutoutsController.listShoutouts],
  ])('allows %s when the tenant plan includes integrations', async (_, controllerClass, handler) => {
    subscriptionsService.hasFeatureAccess.mockResolvedValue(true);

    await expect(
      guard.canActivate(
        createContext({
          controllerClass,
          handler,
          tenantId: 'tenant-1',
        }),
      ),
    ).resolves.toBe(true);

    expect(subscriptionsService.hasFeatureAccess).toHaveBeenCalledWith('tenant-1', [
      FeatureAccess.INTEGRATIONS,
    ]);
  });

  it.each([
    ['categories:list', ShoutoutCategoriesController, categoriesController.listCategories],
    ['shoutouts:create', ShoutoutsController, shoutoutsController.createShoutout],
  ])('denies %s when the tenant plan lacks integrations', async (_, controllerClass, handler) => {
    subscriptionsService.hasFeatureAccess.mockResolvedValue(false);

    try {
      await guard.canActivate(
        createContext({
          controllerClass,
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
});
