/**
 * Staging sandbox smoke checklist for rewards wallet checkout funding.
 * Prints steps for NG (Nomba/Monnify) and non-NG (Noah) tenants — run before go-live.
 *
 * Usage: pnpm --filter api smoke:wallet
 */
const checklist = `
Rewards wallet — staging sandbox smoke checklist
================================================

Prerequisites
- Staging API with sandbox payment keys (NOMBA_LIVE/MONNIFY_LIVE/NOAH_ENVIRONMENT unset or sandbox)
- Boot logs show sandbox mode and webhook secrets configured
- Two test tenants: one with country NG, one with country US (or other non-NG)

NG tenant (Nomba or Monnify per NG_PAYMENTS_PROVIDER; optional NG_WALLET_PAYMENTS_PROVIDER=bachs for deposits)
1. Settings → Rewards → Top up → enter amount → redirect to sandbox checkout
2. Complete sandbox payment → webhook fires → wallet balance increases in NGN
3. Replay the same webhook payload/reference → balance unchanged (idempotent)
4. Burst top-up requests → expect 429 after rate limit
5. With funded wallet, change workspace preferred currency → API 400 with lock message

Non-NG tenant (Noah)
1. Settings → Rewards → Top up → redirect to Noah sandbox checkout
2. Complete sandbox payment → webhook → balance increases in USD (wallet currency)
3. Replay webhook → balance unchanged
4. Funded wallet blocks preferred currency / country change with lock message

API curl spot-checks (replace TOKEN, TENANT_ID, BASE_URL)
- GET  $BASE_URL/v1/tenants/$TENANT_ID/rewards/wallet  → note currencyCode, checkoutLive
- POST $BASE_URL/v1/tenants/$TENANT_ID/rewards/wallet/topup/checkout  body: {"amount":5000}
- PATCH tenant preferredCurrency with funded wallet → expect 400

Sign-off
[ ] NG sandbox top-up + idempotent webhook
[ ] Non-NG sandbox top-up + idempotent webhook
[ ] Currency lock on funded wallet settings change
[ ] audit:wallet-currency → zero locked mismatches
`;

console.log(checklist.trim());
