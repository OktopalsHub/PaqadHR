export const CSP_NONCE_HEADER = 'x-nonce';

export async function getCspNonce(): Promise<string | undefined> {
  const { headers } = await import('next/headers');
  return (await headers()).get(CSP_NONCE_HEADER) ?? undefined;
}
