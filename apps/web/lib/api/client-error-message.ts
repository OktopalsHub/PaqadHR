type ErrorPayload = {
  message?: string | string[];
  code?: string;
} | null;

export function resolveApiErrorMessage(status: number, payload: ErrorPayload): string {
  const payloadMessage = Array.isArray(payload?.message)
    ? payload.message.join(', ')
    : payload?.message;

  if (payloadMessage) {
    return payloadMessage;
  }

  if (status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  return `Request failed (${status})`;
}
