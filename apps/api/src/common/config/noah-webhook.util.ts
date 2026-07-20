import { createVerify } from 'node:crypto';
import { getNoahWebhookPublicKey } from './noah.config';

export function verifyNoahWebhookSignature(rawBody: string, signature: string): boolean {
  if (!signature?.trim()) {
    return false;
  }

  const publicKey = getNoahWebhookPublicKey();
  if (!publicKey) {
    return false;
  }

  try {
    const signatureBytes = Buffer.from(signature.trim(), 'base64');
    const verifier = createVerify('SHA384');
    verifier.update(rawBody);
    return verifier.verify(publicKey, signatureBytes);
  } catch {
    return false;
  }
}
