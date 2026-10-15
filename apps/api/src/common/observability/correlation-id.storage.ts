import { AsyncLocalStorage } from 'node:async_hooks';

type CorrelationStore = {
  correlationId: string;
};

export const correlationIdStorage = new AsyncLocalStorage<CorrelationStore>();

export function getRequestCorrelationId(): string | undefined {
  return correlationIdStorage.getStore()?.correlationId;
}
