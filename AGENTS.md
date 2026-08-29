# AI Agent Instructions

All AI agents and tools working in this repository **must** follow these documents before generating or modifying code. These rules are editor-agnostic — they apply in Cursor, Claude Code, Copilot, or any other assistant.

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | **Mandatory** — OWASP API security mandate, auth/authz, validation, rate limits, logging |
| [PERFORMANCE.md](./PERFORMANCE.md) | **Mandatory** — query efficiency, column selection, pagination, batching, no premature caching |
| [docs/agent-api-auth.md](./docs/agent-api-auth.md) | Runtime agent authentication (JWT, API keys, agent gateway) |
| [docs/openapi.json](./docs/openapi.json) | Committed OpenAPI spec for API discovery |

## Workflow

1. **Detect layer from code signals** — see below. Do not assume folder names; this repo's layout may change (`features/`, `packages/`, etc.).
2. **Read SECURITY.md** — apply authentication, authorization, validation, and checklist rules to every change.
3. **Read PERFORMANCE.md** — selective columns, no N+1 queries, paginate lists, batch writes.
4. **Trace the real flow** — read existing code in the area you touch; reuse guards, DTOs, hooks, and services already there.
5. **Run the checklists** in SECURITY.md and PERFORMANCE.md before finishing.

## Monorepo map

| Path | Purpose |
|------|---------|
| `apps/api/` | NestJS REST API, webhooks, integrations |
| `apps/web/` | Next.js App Router frontend |
| `packages/contracts/` | Shared types: API key scopes, agent action names |
| `packages/mcp-server/` | MCP server exposing curated HR tools |
| `constants/` | Shared JSON (reserved tenant slugs) |
| `docs/` | Operational docs, OpenAPI spec |

### API modules (`apps/api/src/modules/v1/`)

| Module | Purpose |
|--------|---------|
| `activities` | Workspace activity feed |
| `address` | Employee addresses |
| `analytics` | Workforce metrics |
| `api-keys` | Tenant API keys for agents/integrations |
| `agent-actions` | Semantic agent gateway + approval queue |
| `attendance` | Clock in/out, policies |
| `audit-logs` | Security audit trail |
| `auth` | Login, JWT, OAuth, sessions |
| `calendar-events` | Company calendar |
| `departments` | Org departments |
| `document` | Employee document vault |
| `education` | Employee education records |
| `emergency-contact` | Emergency contacts |
| `employment` | Employment contracts |
| `invitations` | Team invites |
| `leave` | Leave requests and approvals |
| `leave-balance` | Accrued balances |
| `leave-policy` | Leave policies |
| `leave-type` | Leave type definitions |
| `notifications` | In-app + email notifications |
| `payment-method` | Payout bank details |
| `payroll` | Payroll runs and disbursement |
| `plans` | Subscription plans |
| `position` | Job positions |
| `recruitment` | Jobs, candidates, interviews |
| `rewards` | Points redemption, wallet |
| `shoutouts` | Peer recognition + Slack |
| `subscriptions` | Tenant billing |
| `teams` | Cross-functional teams |
| `tenant-members` | Workspace members |
| `tenant-settings` | Workspace config |
| `tenants` | Workspace CRUD, onboarding |
| `users` | Global user accounts |
| `webhooks` | Payment + Slack webhooks |

### Web features (`apps/web/features/`)

Route pages in `app/` are thin; UI logic lives in `features/<domain>/`. API calls go through `lib/api/*.ts` and TanStack Query hooks in `hooks/queries/`.

## Auth and guard decision tree

Use these decorators on controllers/handlers:

| Decorator | When to use |
|-----------|-------------|
| `@Public()` | No auth (health, webhooks, public careers, auth endpoints) |
| `@AuthOnly()` | JWT/API key required, no tenant context |
| `@RequireTenant()` | Tenant ID in route/header required at guard layer |
| `@UseGuards(TenantMemberGuard)` | Verify user/key belongs to `:tenantId` |
| `@Roles(...)` + `TenantRoleGuard` | Role check within tenant (OWNER, ADMIN, etc.) |
| `@RequireFeatures(...)` | Subscription plan feature gate |

**BOLA/IDOR:** Every read/write by ID must verify `tenantId` scope in the service layer, not only in the route.

**Agent auth:** API keys (`Bearer paq_...`) populate `request.auth` with `authType: 'api_key'` and scoped permissions. MCP and agents use `POST /agent/actions` (version-neutral; tenant derived from key). Tenant-scoped approval routes remain under `/api/v1/tenants/:tenantId/agent/approvals/*`.

## Change recipes

### Add a new leave type
1. Entity already exists — use `leave-type` module
2. DTO: `apps/api/src/modules/v1/leave-type/dto/`
3. Controller/service in `leave-type/`
4. Web: `features/leaves/` + `lib/api/leaves.ts` + `hooks/queries/`
5. Migration if schema changes

### Add a tenant-scoped API endpoint
1. Controller under `tenants/:tenantId/...`
2. `@UseGuards(TenantMemberGuard)` + role guard if needed
3. DTO with `class-validator` (whitelist enforced globally)
4. Service verifies `tenantId` on all queries
5. Web API module + query hook

### Add an agent-callable action
1. Add action name to `packages/contracts/src/agent-actions.ts`
2. Register handler in `agent-actions.service.ts`
3. Map required API key scopes
4. Add MCP tool in `packages/mcp-server/`
5. Log via `ActivitiesService` with `actorType` in metadata

## Local development

```bash
pnpm install
pnpm --filter api dev          # API on :9001
pnpm --filter web dev          # Web on :3000
pnpm --filter api openapi:export  # Regenerate docs/openapi.json
```

- Swagger UI: `http://localhost:9001/docs` (non-production only)
- OpenAPI artifact: `docs/openapi.json`
- Slack slash commands: register `/leaves`, `/approvals`, `/shoutout`, `/payroll`, `/paqadhr` at `/api/v1/webhooks/slack/slash-commands`; interactivity at `/api/v1/webhooks/slack/interactive`

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
