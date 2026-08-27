# PaqadHR — Agent Guide

> All-in-one HR platform. `pnpm` + `turbo` monorepo: `apps/api` (NestJS + TypeORM + PostgreSQL) and `apps/web` (Next.js + TanStack Query).

This file is always-loaded context. Keep it under 150 lines. Push detail behind pointers.

## Mandatory pointers — read before you touch code

- **security** — `SECURITY.md`: branches `auth` (zero-trust JWT, `@Public()` only), `BOLA/IDOR` (ownership + `tenantId`), `validation` (DTO whitelist `forbidNonWhitelisted`), `rate-limits` (tiers + 429), `logging` (no PII/tokens). Run checklist in §12 before finishing.
- **performance** — `PERFORMANCE.md`: branches `select` (only DTO columns), `N+1` (joins/relations), `pagination` (bounded lists), `batching` (bulk saves), `no-cache` (measure first). Run checklist before finishing.

If you touch both API and client in one file, apply both pointer sets where each concern appears.

## Stack & layout

- `apps/api` → NestJS, TypeORM, guards, DTOs, services, repositories
- `apps/web` → Next.js, React, `use client`, Tailwind, TanStack Query
- Shared → `constants/`, `packages/*`, types/utils used by both
- Env is source of truth: `package.json` scripts, `turbo.json` tasks, `biome.json` formatting. Do not duplicate them here.

## Workflow — do in order

1. **layer** — Detect layer from code signals, not folder names. Table below.
2. **read pointers** — Open the pointer that matches your branches (security and/or performance). Follow its rules.
3. **trace** — Read the real flow end-to-end in the area you touch; reuse existing guards, DTOs, hooks, services.
4. **edit** — Smallest correct diff; fix shared functions once at the root cause.
5. **verify** — Non-trivial logic gets one minimal check that fails if it breaks. Run `pnpm check` and the relevant checklist.
   - Criterion: every modified endpoint passes the security and performance checklists, and existing tests stay green.

## Layer detection

| Layer | Signals | Pointer |
|-------|---------|---------|
| Backend API | `@nestjs/*`, TypeORM, guards, DTOs, controllers, services | `security` backend + `performance` database/API |
| Frontend / client | React, Next.js, `use client`, components, forms | `security` frontend + `performance` web |
| Data fetching | `@tanstack/react-query`, `useQuery`, `useMutation` (any folder) | `performance` data-fetching + `security` frontend auth |

If layout changes (`features/`, `packages/`), signals still win.

## Engineering discipline

- Read the code you change end-to-end before editing.
- Reuse existing helpers, guards, patterns — do not reimplement.
- Co-locate related rules under one heading; keep one source of truth.
- Prefer positive phrasing ("use `httpOnly` cookies") over negated bans.

## Non-negotiables (summary — detail lives in pointers)

- Zero-trust auth on every API route; `@Public()` only where explicitly intended.
- BOLA/IDOR prevention — verify `tenantId` + ownership on every resource access.
- DTO validation with `whitelist: true, forbidNonWhitelisted: true`; reject unknown keys.
- `httpOnly, Secure, SameSite` cookies for tokens — never `localStorage`.
- Select only columns needed for the response; paginate every growing list.
- No secrets, PII, or tokens in logs or client bundles.

## Skills — `.agents/skills` (Matt Pocock, 36 skills)

Router: `/ask-matt` — picks the right skill for your situation.

- **ship** — `/to-spec` → `/to-tickets` → `/implement` → `/tdd` (idea→ship spine)
- **sharpen** — `/grill-me`, `/grill-with-docs` (relentless interview; docs as you go)
- **design** — `/domain-modeling` (ubiquitous language, `CONTEXT.md`, ADRs), `/codebase-design` (deep modules)
- **quality** — `/code-review` (standards + spec), `/diagnosing-bugs`, `/improve-codebase-architecture`
- **plan** — `/wayfinder`, `/triage`, `/wizard`

Full list and usage: `npx skills list` or read `.agents/skills/<name>/SKILL.md`. Keep skills behind their pointer; do not inline them here.

Update skills: `npx skills update` (or `npx skills update -p` for project only).

## Domain & decisions

- **domain** — Use `/domain-modeling` when you change terminology, edit `CONTEXT.md`, or record an ADR.
- **sharpen** — Use `/grill-with-docs` when a plan feels fuzzy; it interviews you and writes ADR + glossary as you go.
- Keep ubiquitous language in one place; change it in one edit.

## Writing this file — `writing-for-agents`

This `AGENTS.md` follows Matt Pocock's `writing-for-agents` hierarchy: steps over reference, progressive disclosure behind pointers, leading words as triggers, single source of truth, and pruning no-ops. When you edit this file or any skill, read `.agents/skills/writing-for-agents/SKILL.md` first. Keep always-loaded lines short; push branching detail to disclosed reference.

## Verify — completion criteria

- `pnpm check` passes (Biome).
- Security checklist `SECURITY.md#12` passes — no new BOLA, auth, or validation gaps.
- Performance checklist `PERFORMANCE.md#mandatory` passes — no N+1, no unbounded lists, no full-entity loads for partial DTOs.
- Existing tests stay green (`pnpm test` where relevant).

If you find a violation, fix at the shared layer (guard, DTO, repository) rather than per-endpoint.

## Commands (verify in `package.json`)

```bash
pnpm install          # install
pnpm dev              # turbo dev (api :9001, web :3000)
pnpm check            # biome check
pnpm check:fix        # biome fix
pnpm build            # turbo build
```

## Reporting security issues

See `SECURITY.md#vulnerability-reporting` — private report to `support@paqad.com`, not public issues.
