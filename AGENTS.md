# AI Agent Instructions

All AI agents and tools working in this repository **must** follow these documents before generating or modifying code. These rules are editor-agnostic — they apply in Cursor, Claude Code, Copilot, or any other assistant.

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | **Mandatory** — OWASP API security mandate, auth/authz, validation, rate limits, logging |
| [PERFORMANCE.md](./PERFORMANCE.md) | **Mandatory** — query efficiency, column selection, pagination, batching, no premature caching |

## Workflow

1. **Detect layer from code signals** — see below. Do not assume folder names; this repo's layout may change (`features/`, `packages/`, etc.).
2. **Read SECURITY.md** — apply authentication, authorization, validation, and checklist rules to every change.
3. **Read PERFORMANCE.md** — selective columns, no N+1 queries, paginate lists, batch writes.
4. **Trace the real flow** — read existing code in the area you touch; reuse guards, DTOs, hooks, and services already there.
5. **Run the checklists** in SECURITY.md and PERFORMANCE.md before finishing.

## Layer detection (use signals, not paths)

| Layer | Look for | Rules |
|-------|----------|-------|
| **Backend API** | `@nestjs/*`, TypeORM, guards, DTOs, controllers, services, repositories | SECURITY.md backend sections, PERFORMANCE.md database/API sections |
| **Frontend / client** | React, Next.js, `use client`, components, forms, UI state | SECURITY.md frontend sections, PERFORMANCE.md web sections |
| **Data fetching (anywhere)** | TanStack Query (`useQuery`, `useMutation`, `@tanstack/react-query`) — often in `features/`, `hooks/`, or route modules | PERFORMANCE.md data-fetching rules; avoid over-fetch and duplicate requests |
| **Shared** | Types, utils, constants used by both sides | No secrets in shared client bundles; strictest rule wins |

If a file mixes layers (e.g. a feature hook calling the API), apply both backend and frontend rules where each concern appears.

## Engineering discipline

- Read the code you are changing end-to-end before editing.
- Reuse existing helpers, guards, and patterns — do not reimplement what is already in the repo.
- Smallest correct diff; fix shared functions once at the root cause.
- Non-trivial logic gets one minimal check that fails if the logic breaks.

## Non-negotiables

- Zero-trust auth on API routes; public access only where explicitly intended
- DTO/schema validation with whitelist — reject unknown fields
- BOLA/IDOR prevention — verify ownership and tenant scope on every resource access
- httpOnly cookies for tokens — never `localStorage`
- Select only DB columns needed for the response — do not load full entities for partial DTOs
- Rate limits on public/abusable and money-moving endpoints — `@RateLimit(RateLimitPresets.X)` (see [SECURITY.md](./SECURITY.md#route-level-rate-limits))
- No secrets, PII, or tokens in logs

## Reporting security issues

See [SECURITY.md — Vulnerability Reporting](./SECURITY.md#vulnerability-reporting).

## Payment provider routing (API)

Payroll money movement routes by currency and business purpose, with no provider fallback. NGN payroll uses a distinct Nomba checkout followed by individual Nomba bank transfers; it stays disabled until the account is approved, `NOMBA_PAYROLL_NGN_ENABLED=true`, and `PAYROLL_PAYOUT_FEE_NOMBA_NGN` is set from Nomba's confirmed tariff. USD/EUR/GBP and USDC/USDT payroll remain on Bridge, enabled only by exact `BRIDGE_PAYROLL_CAPABILITIES` entries. Bachs is for subscriptions. Nomba also handles Nigerian shout-out/rewards purchases. Legacy payroll transactions retain their original provider references for reconciliation.

| Env | Values | Scope |
|-----|--------|--------|
| `BRIDGE_API_KEY` | Bridge API key | Bridge wallet and payroll API access |
| `BRIDGE_WEBHOOK_PUBLIC_KEY` | Bridge webhook endpoint public key | Raw-body signature verification for funding and transfer events |
| `BRIDGE_PAYROLL_CAPABILITIES` | JSON array; default `[]` | Exact enabled operation/source currency/destination currency/country/network routes. `wallet_transfer` and `withdrawal` entries also require `bridgeCurrency` and `bridgePaymentRail`; wallet creation requires `bridgeChain` |
| `BRIDGE_DEVELOPER_FEE_COLLECTION_ENABLED` | `true` only after Bridge configures PaqadHR's fee settlement account; default `false` | Enables the plan-based PaqadHR payroll percentage as a Bridge developer fee on supported stablecoin wallet transfers. Bridge fee settlement is monthly; do not enable without the configured settlement account |
| `NOMBA_PAYROLL_NGN_ENABLED` | `true` only after Nomba payroll approval; default `false` | Enables NGN-only payroll checkout and bank payout routing through Nomba |
| `PAYROLL_NOMBA_TRANSFER_CHARGE_NGN` | Default `50` | PaqadHR's ₦50 markup per NGN employee transfer, added to Nomba's payout fee |
| `PAYROLL_PAYOUT_FEE_NOMBA_NGN` | Required account-confirmed amount | Nomba's separate per-transfer bank fee reserve; the shared estimate tops out at ₦50 plus VAT (₦53.75), but confirm the account tariff. Do not copy card checkout pricing here |
| `NG_REWARDS_DEPOSIT_PROVIDER` | `nomba` \| `monnify` \| `fincra` \| `bachs` | NG wallet checkout deposits |
| `INTL_REWARDS_DEPOSIT_PROVIDER` | `noah` \| `fincra` | Non-NG wallet checkout deposits (USD wallets use Bachs when `BACHS_WALLET_TOPUP_PRODUCT_USD` is set) |
| `NG_REWARDS_AIRTIME_PROVIDER` | `nomba` \| `monnify` | Airtime/utilities only (not Fincra) |

Fincra credentials from the dashboard (**Profile → API keys and webhook Configuration**; toggle Sandbox/Live to match `FINCRA_LIVE`): **Secret Key** → `FINCRA_API_KEY` (server `api-key` header), **Public Key** → `FINCRA_PUBLIC_KEY` (checkout `x-pub-key`), **Webhook Encryption Key** → `FINCRA_WEBHOOK_SECRET`. Business ID is resolved automatically via Fincra’s profile API when unset (`FINCRA_BUSINESS_ID` optional override). `FINCRA_PAYOUT_SOURCE_CURRENCY` is optional (defaults from business country). Fincra wallet deposits are **checkout-only** — no saved-card manual top-up or automatic top-up. Bachs wallet deposits use [overlay checkout](https://docs.bachs.io/guides/checkout/overlay-checkout) (`bachs.js`) on the web app; the first checkout saves a card (`save_payment_method` + `payment_method.saved`), then manual/auto top-up charges that card off-session (`POST /v1/charges`). Fulfilment is always the `collection.succeeded` webhook, never the browser event. Webhook signatures are always required.

Bachs adaptive pricing: org-level `adaptive_pricing` may be on for **subscription** USD checkouts (local-currency chooser). **Wallet and payroll-float** Bachs checkouts always pin `billing_currency` to the wallet/float currency and credit only `expectedAmount` — never trust a larger provider figure. Bachs customers are scoped per tenant (plus-address tag) so shared billing emails cannot bind one card across workspaces.

Bridge payroll transfer notes: each employee payout is independently tracked. Stablecoin payouts transfer from the organization-owned Bridge wallet to the employee-owned Bridge wallet. USD/EUR/GBP bank payouts use two transfers: first to the employee-owned wallet, then from that same customer's wallet to their linked external bank account with a fixed destination amount. Use the employer's Bridge customer ID as `on_behalf_of`, stable per-item idempotency keys, and Bridge's `payment_processed` state as each transfer's success boundary. Ambiguous submissions remain reserved until a signed webhook or an idempotent status replay resolves them. Bank payouts require an active Bridge external account plus exact wallet-transfer and withdrawal capabilities; default capabilities are empty. NGN uses Nomba's merchant settlement balance and a separate Nomba checkout; Nomba pays each employee's verified Nigerian bank account directly. NGN runs must contain NGN items only and be funded through the Nomba checkout before payout. Payout batches are concurrency-bounded, and unknown submissions remain processing under the same merchant reference until webhook/status reconciliation resolves them.

The PaqadHR payroll percentage comes from the active plan's `payrollFeePercentage` (for example 3%, 2.5%, or 2%). It is separate from Bachs subscription billing. On supported stablecoin wallet transfers, Bridge collects it as a developer fee while the employer funds salary plus fee so employees receive their approved net amount. Bridge holds developer fees and settles them monthly; the internal ledger records the amount as a fee receivable. Bridge transfer and FX costs are confirmed from transfer receipts where available; do not present an indicative FX rate or dry-run route validation as a locked fee quote.
