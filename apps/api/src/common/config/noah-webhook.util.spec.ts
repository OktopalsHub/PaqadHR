import { generateKeyPairSync, createSign } from 'node:crypto';
import { verifyNoahWebhookSignature } from './noah-webhook.util';

describe('verifyNoahWebhookSignature', () => {
  const rawBody = JSON.stringify({ event_type: 'payment_success', data: { externalID: 'nw_abc' } });

  let publicKeyPem: string;
  let privateKeyPem: string;

  beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  });

  beforeEach(() => {
    process.env.NOAH_WEBHOOK_PUBLIC_KEY = publicKeyPem;
  });

  afterEach(() => {
    delete process.env.NOAH_WEBHOOK_PUBLIC_KEY;
  });

  function signBody(body: string): string {
    const signer = createSign('SHA384');
    signer.update(body);
    return signer.sign(privateKeyPem).toString('base64');
  }

  it('accepts valid ECDSA signatures', () => {
    expect(verifyNoahWebhookSignature(rawBody, signBody(rawBody))).toBe(true);
  });

  it('rejects invalid signatures', () => {
    expect(verifyNoahWebhookSignature(rawBody, Buffer.from('deadbeef').toString('base64'))).toBe(
      false,
    );
  });

  it('rejects when public key is not configured', () => {
    delete process.env.NOAH_WEBHOOK_PUBLIC_KEY;
    expect(verifyNoahWebhookSignature(rawBody, signBody(rawBody))).toBe(false);
  });

  it('rejects tampered body', () => {
    const signature = signBody(rawBody);
    expect(verifyNoahWebhookSignature(`${rawBody}x`, signature)).toBe(false);
  });
});
