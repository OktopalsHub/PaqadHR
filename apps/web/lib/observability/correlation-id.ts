const CORRELATION_ID_HEADER = 'x-correlation-id';

let correlationId: string | null = null;

function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getCorrelationId(): string {
  if (!correlationId) {
    correlationId = createCorrelationId();
  }
  return correlationId;
}

export function resetCorrelationId(): void {
  correlationId = null;
}

export function getCorrelationIdHeaderName(): string {
  return CORRELATION_ID_HEADER;
}
