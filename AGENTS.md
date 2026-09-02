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
| `NG_PAYROLL_PROVIDER` | `nomba` \| `monnify` \| `fincra` | NGN payroll bank payouts |
| `INTL_PAYROLL_PROVIDER` | `noah` \| `fincra` | USD/EUR/GBP bank + USDT/USDC crypto payroll |
| `NG_REWARDS_DEPOSIT_PROVIDER` | `nomba` \| `monnify` \| `fincra` \| `bachs` | NG wallet checkout deposits |
| `INTL_REWARDS_DEPOSIT_PROVIDER` | `noah` \| `fincra` | Non-NG wallet checkout deposits |
| `NG_REWARDS_AIRTIME_PROVIDER` | `nomba` \| `monnify` | Airtime/utilities only (not Fincra) |

Fincra credentials from the dashboard: `FINCRA_API_KEY` (secret, server `api-key` header), `FINCRA_PUBLIC_KEY` (checkout `x-pub-key` header), `FINCRA_WEBHOOK_SECRET`, `FINCRA_LIVE`. Business ID is resolved automatically via Fincra’s profile API when unset (`FINCRA_BUSINESS_ID` optional override). `FINCRA_PAYOUT_SOURCE_CURRENCY` is optional (defaults from business country). Bachs and Fincra wallet deposits are **checkout-only** — no saved-card manual top-up or automatic top-up. Webhook signatures are always required.
