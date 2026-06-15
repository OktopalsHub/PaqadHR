import { AsyncLocalStorage } from 'node:async_hooks';
import type { MemberContext, TenantContext } from '../interfaces/context.interface';

interface TenantContextStore {
  tenant?: TenantContext;
  member?: MemberContext;
}

class TenantContextManager {
  private readonly storage = new AsyncLocalStorage<TenantContextStore>();

  run<T>(store: TenantContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  updateContext(partial: Partial<TenantContextStore>): void {
    const store = this.storage.getStore();
    if (store) {
      Object.assign(store, partial);
    }
  }

  getCurrentTenant(): TenantContext | undefined {
    return this.storage.getStore()?.tenant;
  }

  getCurrentTenantId(): string | undefined {
    return this.getCurrentTenant()?.id;
  }

  getCurrentMember(): MemberContext | undefined {
    return this.storage.getStore()?.member;
  }
}

export const tenantContext = new TenantContextManager();
