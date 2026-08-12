/** Map Noah HTTP failures to operator-facing API errors (never include secrets). */
export function formatNoahHttpError(status: number, upstreamMessage: string): string {
  if (status === 401) {
    const detail = upstreamMessage.toLowerCase();
    if (detail.includes('signature not provided') || detail.includes('signature')) {
      return 'Noah checkout requires request signing for this API key. Set NOAH_SIGNING_PRIVATE_KEY to the ES384 private key registered in the Noah dashboard for this key, or create a sandbox API key without an associated signing public key.';
    }
    return 'Noah checkout authentication failed. Verify NOAH_API_KEY, NOAH_ENVIRONMENT (sandbox vs production), and NOAH_SIGNING_PRIVATE_KEY if set.';
  }
  return `Noah Error: ${upstreamMessage}`;
}

/** Noah success statuses for payouts and checkout. */
export function isNoahOperationSuccessful(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toUpperCase();
  return (
    s === 'SUCCESS' ||
    s === 'COMPLETED' ||
    s === 'SUCCEEDED' ||
    s === 'PAID' ||
    s === 'SETTLED' ||
    s === 'ACTIVE' ||
    s.includes('PROCESS') ||
    s === 'PENDING'
  );
}

export function isNoahTerminalFailure(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toUpperCase();
  return (
    s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED' || s === 'REJECTED' || s === 'REFUNDED'
  );
}

/** True when a sync verify or webhook status indicates payment completed. */
export function isNoahPaymentVerified(status?: string | null): boolean {
  if (!status) {
    return false;
  }
  const s = status.toLowerCase();
  return (
    s === 'success' ||
    s === 'successful' ||
    s === 'settled' ||
    s === 'completed' ||
    s === 'paid' ||
    s === 'succeeded'
  );
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return undefined;
}

/** Map Noah PascalCase webhook payloads to the snake_case shape used by parsers. */
export function normalizeNoahWebhookPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const body = payload as Record<string, unknown>;
  const eventType = pickString(body, 'EventType', 'eventType', 'event_type', 'type');
  const rawData = body.Data ?? body.data;

  let data: Record<string, unknown> | undefined;
  if (rawData && typeof rawData === 'object') {
    const source = rawData as Record<string, unknown>;
    data = { ...source };
    data.status = pickString(source, 'status', 'Status');
    data.externalID = pickString(
      source,
      'externalID',
      'externalId',
      'ExternalID',
      'Reference',
      'reference',
    );
    data.transactionID = pickString(
      source,
      'transactionID',
      'transactionId',
      'TransactionID',
      'ID',
      'id',
    );
    data.metadata = source.metadata ?? source.Metadata;
    data.amount = source.amount ?? source.Amount ?? source.fiatAmount ?? source.FiatAmount;
    data.currency =
      source.currency ?? source.Currency ?? source.fiatCurrency ?? source.FiatCurrency;
    data.paymentMethodID = source.paymentMethodID ?? source.PaymentMethodID;
    data.customerEmail = source.customerEmail ?? source.CustomerEmail;
    if (source.order) {
      data.order = source.order;
    }
  }

  return {
    ...body,
    EventType: eventType,
    eventType,
    event_type: eventType,
    type: eventType,
    Data: data,
    data,
    EventVersion: body.EventVersion ?? body.eventVersion,
    eventVersion: body.EventVersion ?? body.eventVersion,
  };
}
