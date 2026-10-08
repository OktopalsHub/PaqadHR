import { randomUUID } from 'node:crypto';

const apiUrl = (process.env.PAQADHR_API_URL ?? 'http://localhost:9001').replace(/\/$/, '');
const apiKey = process.env.PAQADHR_API_KEY?.trim();

export function requireConfig(): { apiUrl: string; apiKey: string } {
  if (!apiKey?.startsWith('paq_')) {
    throw new Error('PAQADHR_API_KEY must be set to a paq_... tenant API key');
  }
  if (process.env.PAQADHR_TENANT_ID?.trim()) {
    console.warn(
      'PAQADHR_TENANT_ID is deprecated and ignored; tenant is derived from the API key.',
    );
  }
  return { apiUrl, apiKey };
}

export async function callAgentAction(
  action: string,
  params: Record<string, unknown> = {},
  idempotencyKey?: string,
): Promise<unknown> {
  const { apiUrl, apiKey } = requireConfig();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'x-correlation-id': randomUUID(),
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const controller = new AbortController();
  const timeoutMs = 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/agent/actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Agent action timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: string }).message)
        : `Agent action failed (${response.status})`,
    );
  }
  return body;
}
