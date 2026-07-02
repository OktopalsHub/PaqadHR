import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;

    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
}

type CheckResult = { name: string; ok: boolean; detail: string };

function checkEnv(): CheckResult[] {
  const required = [
    'NOMBA_CLIENT_ID',
    'NOMBA_CLIENT_SECRET',
    'NOMBA_ACCOUNT_ID',
    'NOMBA_WEBHOOK_SIGNATURE_KEY',
  ] as const;

  const optional = ['NOMBA_BASE_URL', 'NOMBA_PAYOUT_AUTH_CODE'] as const;

  const results: CheckResult[] = required.map((key) => ({
    name: key,
    ok: Boolean(process.env[key]?.trim()),
    detail: process.env[key]?.trim() ? 'set' : 'missing',
  }));

  for (const key of optional) {
    const value = process.env[key]?.trim();
    results.push({
      name: key,
      ok: true,
      detail: value ? value : 'not set (optional)',
    });
  }

  return results;
}

async function checkAuthToken(): Promise<CheckResult> {
  const baseUrl = (process.env.NOMBA_BASE_URL || 'https://api.nomba.com').replace(/\/$/, '');
  const clientId = process.env.NOMBA_CLIENT_ID?.trim();
  const clientSecret = process.env.NOMBA_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return { name: 'auth/token', ok: false, detail: 'skipped — missing client credentials' };
  }

  try {
    const response = await fetch(`${baseUrl}/v1/auth/token/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const payload = (await response.json()) as { data?: { access_token?: string } };
    if (!response.ok || !payload.data?.access_token) {
      return {
        name: 'auth/token',
        ok: false,
        detail: `HTTP ${response.status} — token issue failed`,
      };
    }

    return { name: 'auth/token', ok: true, detail: 'access token issued' };
  } catch (error) {
    return {
      name: 'auth/token',
      ok: false,
      detail: error instanceof Error ? error.message : 'request failed',
    };
  }
}

function checkPayoutAuthCode(): CheckResult {
  const authCode = process.env.NOMBA_PAYOUT_AUTH_CODE?.trim();
  if (authCode) {
    return { name: 'NOMBA_PAYOUT_AUTH_CODE', ok: true, detail: 'set' };
  }
  return {
    name: 'NOMBA_PAYOUT_AUTH_CODE',
    ok: true,
    detail: 'not set — required only for non-NGN global payouts',
  };
}

function printDepositWebhookCurlExample(): void {
  const secret = process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!secret) return;

  const appUrl = (process.env.APP_URL || 'https://your-api.example.com').replace(/\/$/, '');
  const body =
    '{"event_type":"deposit.success","data":{"virtualAccount":"9900012345","amount":5000,"transactionReference":"sandbox-deposit-001","senderName":"Sandbox Payer"}}';

  console.log('\nExample rewards wallet deposit webhook curl:\n');
  console.log(`BODY='${body}'`);
  console.log(`SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${secret}" | awk '{print $2}')`);
  console.log(
    `curl -X POST "${appUrl}/api/v1/webhooks/nomba" -H "Content-Type: application/json" -H "x-nomba-signature: $SIG" -d "$BODY"`,
  );
  console.log('');
}

async function checkVirtualAccountCreate(): Promise<CheckResult> {
  const baseUrl = (process.env.NOMBA_BASE_URL || 'https://api.nomba.com').replace(/\/$/, '');
  const clientId = process.env.NOMBA_CLIENT_ID?.trim();
  const clientSecret = process.env.NOMBA_CLIENT_SECRET?.trim();
  const accountId = process.env.NOMBA_ACCOUNT_ID?.trim();

  if (!clientId || !clientSecret || !accountId) {
    return { name: 'virtual-account/create', ok: false, detail: 'skipped — missing credentials' };
  }

  try {
    const tokenRes = await fetch(`${baseUrl}/v1/auth/token/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    const tokenPayload = (await tokenRes.json()) as { data?: { access_token?: string } };
    const token = tokenPayload.data?.access_token;
    if (!tokenRes.ok || !token) {
      return { name: 'virtual-account/create', ok: false, detail: 'token issue failed' };
    }

    const accountRef = `rewards_wallet_sandbox_${Date.now()}`;
    const vaRes = await fetch(`${baseUrl}/v1/accounts/virtual`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId,
      },
      body: JSON.stringify({
        accountRef,
        accountName: 'Paqad Sandbox Wallet',
        currency: 'NGN',
      }),
    });

    const vaPayload = (await vaRes.json()) as { code?: string; data?: { accountNumber?: string } };
    if (!vaRes.ok || vaPayload.code !== '00' || !vaPayload.data?.accountNumber) {
      return {
        name: 'virtual-account/create',
        ok: false,
        detail: `HTTP ${vaRes.status} — VA create failed`,
      };
    }

    return {
      name: 'virtual-account/create',
      ok: true,
      detail: `account ${vaPayload.data.accountNumber} (ref ${accountRef})`,
    };
  } catch (error) {
    return {
      name: 'virtual-account/create',
      ok: false,
      detail: error instanceof Error ? error.message : 'request failed',
    };
  }
}

function printWebhookCurlExample(): void {
  const secret = process.env.NOMBA_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!secret) return;

  const appUrl = (process.env.APP_URL || 'https://your-api.example.com').replace(/\/$/, '');
  const body =
    '{"event_type":"transfer.success","data":{"id":"sandbox-test","status":"SUCCESS","meta":{"merchantTxRef":"payroll_<runId>_<itemId>"}}}';

  console.log('\nExample payroll webhook curl (replace run/item IDs):\n');
  console.log(`BODY='${body}'`);
  console.log(`SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${secret}" | awk '{print $2}')`);
  console.log(
    `curl -X POST "${appUrl}/api/v1/webhooks/nomba" -H "Content-Type: application/json" -H "x-nomba-signature: $SIG" -d "$BODY"`,
  );
  console.log('');
}

function printWebhookUrls(): void {
  const appUrl = (
    process.env.APP_URL ||
    process.env.PUBLIC_APP_URL ||
    'https://your-api.example.com'
  ).replace(/\/$/, '');

  console.log('\nRegister this webhook URL in the Nomba dashboard:\n');
  console.log(`  ${appUrl}/api/v1/webhooks/nomba`);
  console.log(
    '\nEnsure PUBLIC_ROUTES includes /api/v1/webhooks and NOMBA_WEBHOOK_SIGNATURE_KEY matches Nomba.\n',
  );
  printWebhookCurlExample();
  printDepositWebhookCurlExample();
  console.log('\nBackfill existing tenant wallets:\n');
  console.log('  pnpm --filter api provision-reward-vas\n');
}

async function main(): Promise<void> {
  loadEnvFile();

  console.log('Nomba sandbox / production readiness check\n');

  const envResults = checkEnv();
  for (const result of envResults) {
    const icon = result.ok ? '✓' : '✗';
    console.log(`  ${icon} ${result.name}: ${result.detail}`);
  }

  const authResult = await checkAuthToken();
  const icon = authResult.ok ? '✓' : '✗';
  console.log(`  ${icon} ${authResult.name}: ${authResult.detail}`);

  const payoutAuth = checkPayoutAuthCode();
  console.log(`  ✓ ${payoutAuth.name}: ${payoutAuth.detail}`);

  const vaResult = await checkVirtualAccountCreate();
  const vaIcon = vaResult.ok ? '✓' : '✗';
  console.log(`  ${vaIcon} ${vaResult.name}: ${vaResult.detail}`);

  printWebhookUrls();

  const failed = [...envResults.filter((r) => !r.ok), authResult, vaResult].filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `\n${failed.length} check(s) failed. Fix env vars before enabling money features.\n`,
    );
    process.exit(1);
  }

  console.log(
    'All checks passed. Next: POST /api/v1/webhooks/nomba with sandbox deposit payload; verify wallet credit + subscription checkout.\n',
  );
}

void main();
