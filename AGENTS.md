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
- No secrets, PII, or tokens in logs

## Reporting security issues

See [SECURITY.md — Vulnerability Reporting](./SECURITY.md#vulnerability-reporting).

## Payment provider routing (API)

Environment variables select payroll and rewards-wallet rails. Peer fallback applies when the preferred provider is not configured.

| Env | Values | Scope |
|-----|--------|--------|
| `NG_PAYROLL_PROVIDER` | `nomba` \| `monnify` \| `fincra` \| `bachs` | NGN payroll bank payouts |
| `INTL_PAYROLL_PROVIDER` | `noah` \| `fincra` \| `bachs` | USD/EUR/GBP bank + USDT/USDC crypto payroll. `bachs` routes USD (ACH/Wire/RTP), EUR (SEPA), GBP (Faster Payments), and USDT TRC20/BEP20 to Bachs; international bank routes debit the Bachs USD balance |
| `NG_REWARDS_DEPOSIT_PROVIDER` | `nomba` \| `monnify` \| `fincra` \| `bachs` | NG wallet checkout deposits |
| `INTL_REWARDS_DEPOSIT_PROVIDER` | `noah` \| `fincra` | Non-NG wallet checkout deposits (USD wallets use Bachs when `BACHS_WALLET_TOPUP_PRODUCT_USD` is set) |
| `NG_REWARDS_AIRTIME_PROVIDER` | `nomba` \| `monnify` | Airtime/utilities only (not Fincra) |

Fincra credentials from the dashboard (**Profile → API keys and webhook Configuration**; toggle Sandbox/Live to match `FINCRA_LIVE`): **Secret Key** → `FINCRA_API_KEY` (server `api-key` header), **Public Key** → `FINCRA_PUBLIC_KEY` (checkout `x-pub-key`), **Webhook Encryption Key** → `FINCRA_WEBHOOK_SECRET`. Business ID is resolved automatically via Fincra’s profile API when unset (`FINCRA_BUSINESS_ID` optional override). `FINCRA_PAYOUT_SOURCE_CURRENCY` is optional (defaults from business country). Fincra wallet deposits are **checkout-only** — no saved-card manual top-up or automatic top-up. Bachs wallet deposits use [overlay checkout](https://docs.bachs.io/guides/checkout/overlay-checkout) (`bachs.js`) on the web app; the first checkout saves a card (`save_payment_method` + `payment_method.saved`), then manual/auto top-up charges that card off-session (`POST /v1/charges`). Fulfilment is always the `collection.succeeded` webhook, never the browser event. Webhook signatures are always required.

Bachs adaptive pricing: org-level `adaptive_pricing` may be on for **subscription** USD checkouts (local-currency chooser). **Wallet and payroll-float** Bachs checkouts always pin `billing_currency` to the wallet/float currency and credit only `expectedAmount` — never trust a larger provider figure. Bachs customers are scoped per tenant (plus-address tag) so shared billing emails cannot bind one card across workspaces.

Bachs payroll notes: NGN bank payouts use the NGN (or quoted) balance. With `INTL_PAYROLL_PROVIDER=bachs` (and Bachs as the run’s payout rail), USD/EUR/GBP bank payroll and USDT TRC20/BEP20 also go to Bachs — international bank routes **debit the USD balance** (EUR/GBP need a payout quote; USD is same-currency). Mixed-currency runs fund with **one company checkout** quoted into USD (or NGN if everyone is NGN) plus the plan’s Paqad payroll fee %, then fan out to each employee’s payment method. USD destinations need routing number + US bank address (`metadata.bachsBankAddress` or member address via `noahHolderAddress`); GBP needs sort code + account (or GB IBAN); EUR needs IBAN + BIC. Live GBP/EUR destinations may be `pending_review` until Bachs approves them — payroll fails closed until `is_usable`. USDT on TRC20/BEP20 is routed to Bachs by wallet network even when intl preference is Noah/Fincra; Ethereum USDT stays on Noah/Fincra. USDT wallets can only be saved when `INTL_PAYROLL_PROVIDER=bachs` and `BACHS_SECRET_KEY` are set. A USD balance can also fund NGN payouts via a cross-currency payout quote (`BACHS_PAYOUT_SOURCE_CURRENCY=USD`). Every payout sends an `Idempotency-Key` (the payroll merchant ref) — a retry without it can pay twice — and payouts are async: only `payout.paid` / `payout.failed` webhooks mark items terminal. Do not use Bachs payout schedules for payroll (they move settled customer collections only, never top-ups or transfers). No SWIFT.
