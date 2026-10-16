# Cloudflare Web Deploy (Workers Builds)

The web app uses environment-driven configuration for Cloudflare Workers and CI.
Environment-specific URLs and Worker names are not embedded in deployment scripts
or Wrangler config. Local commands read `apps/web/.env.local` / `.env`; GitHub Actions
reads public build values from the selected `production` or `development` environment.

## How a build runs

| Stage | Command | Reads |
|-------|---------|-------|
| Build | `pnpm install --frozen-lockfile && pnpm --filter web run cf:build` | Required `NEXT_PUBLIC_*` values |
| Deploy | `pnpm --filter web run cf:deploy` | The same environment values, via `scripts/cf-config.mjs` |

The scripts load local env files without overriding variables already supplied by
the process, then validate required values. The deploy script generates
`apps/web/.wrangler.deploy.jsonc` at deploy time and passes it to Wrangler.
The generated file is ignored by git.

## Required environment variables

For GitHub Actions, create the `production` and `development` environments in
Repository Settings → Environments. Add the public build variables listed below
to each environment, using the correct URLs for that environment. The workflow
selects `production` for `main` and PRs targeting `main`; it selects `development`
for `dev` and PRs targeting `dev`. Do not set the same URLs for both environments.

For direct Cloudflare Workers Builds or local deploys, set the additional `CF_*`
values in that build environment or `.env.local`. No environment-specific values
are supplied by repository defaults.

| Variable | Required | Purpose |
|----------|----------|---------|
| `CF_WORKER_NAME` | yes | Exact Worker name attached to this build. Use the production Worker for `main` and the development Worker for `dev`. |
| `CF_COMPAT_DATE` | yes | Wrangler compatibility date. |
| `NEXT_PUBLIC_API_URL` | yes | API origin compiled into the frontend. |
| `NEXT_PUBLIC_APP_URL` | yes | Public app origin used for metadata and absolute links. |
| `NEXT_PUBLIC_APP_DOMAIN` | yes | Apex domain used for tenant subdomains. |
| `NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS` | yes | `true` or `false`. |
| `CF_ROUTES` | no | JSON array of custom-domain/route objects. Omitted or blank means no routes are added by the deploy script. |
| `CF_WORKERS_DEV` | no | Set to `true` to publish on `workers.dev`; otherwise disabled. |

Other public build variables include `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`NEXT_PUBLIC_R2_PUBLIC_URL`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, and
`NEXT_PUBLIC_APP_BUILD_ID`. Set them in the appropriate build environment
when required by the app.

## Cloudflare dashboard separation

In Workers & Pages → Workers Builds:

- Connect the production build to branch `main` and the production Worker.
- Connect the development build to branch `dev` and the development Worker.
- Set each build's `CF_WORKER_NAME`, `CF_COMPAT_DATE`, and public URL/domain
  variables in that build's variables/secrets. Do not use one shared value set
  for both environments.
- Under each Worker’s Settings → Domains & Routes, attach the production
  domain only to the production Worker and the development domain only to the
  development Worker.

The repository validates that required values exist, but cannot inspect or
change Cloudflare dashboard settings. A domain attached to the wrong Worker
must be corrected in Cloudflare.
| `CF_WORKER_NAME` | optional | Worker to deploy to. Defaults per branch: `paqadhr` on `main`, `paqadhr-dev` everywhere else (`dev`, previews). Set it to override — and make it match the Worker the build is connected to, otherwise Workers Builds overrides it and warns. |
| `NEXT_PUBLIC_API_URL` | yes | API origin used by the app (`https://api-dev.paqadhr.com`, `https://prod.paqadhr.com`, …). |
| `NEXT_PUBLIC_APP_URL` | recommended | Public app URL, for metadata/absolute links. |
| `NEXT_PUBLIC_APP_DOMAIN` | optional | Apex domain for tenant subdomains. Defaults to `paqadhr.com`. |
| `NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS` | optional | `true`/`false`. Defaults to `true`. |
| `CF_ROUTES` | optional | JSON array of route/custom-domain objects (see below). Omit for no routes. |
| `CF_COMPAT_DATE` | optional | `compatibility_date`. Defaults to the repo pin (`2026-07-01`). |
| `CF_WORKERS_DEV` | optional | `true` also publishes on `workers.dev`. Defaults to `false`. |

`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_R2_PUBLIC_URL`,
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` and
`NEXT_PUBLIC_APP_BUILD_ID` are build-time only (inlined into the bundle), so
they just need to be present in the build environment; they are not part of the
wrangler config.

Deploys run with `--keep-vars`: any var set directly on the Worker in the
Cloudflare dashboard wins over the config, and vars that only exist in the
dashboard (PostHog, Sentry, …) survive every deploy.

## Tenant subdomains

Workspaces are served at `<slug>.<app-domain>` (`acme.paqadhr.com`, and
`acme.dev.paqadhr.com` in dev). They are **not** a Worker route:

- A `*.paqadhr.com/*` route matches every sub-host, including the API origins
  (`prod.paqadhr.com`, `api-dev.paqadhr.com`) — a route cannot exclude a
  hostname, so attaching one takes the API down.
- Instead, each tenant hostname is attached to the web Worker as a **custom
  domain**. Cloudflare then creates the DNS record and certificate, and the API
  hosts keep resolving straight to the VPS.

The API does this at workspace creation, and detaches it on permanent delete:

| Variable | Purpose |
|----------|---------|
| `CF_WORKER_DOMAIN_API_TOKEN` | Cloudflare API token (Workers Scripts:Edit + Zone:Read for the app zone) |
| `CF_WORKER_DOMAIN_ZONE_ID` | Zone the tenant hostnames live in |
| `CF_WORKER_DOMAIN_WORKER_NAME` | Worker that serves tenants (`paqadhr` in prod, `paqadhr-dev` in dev) |
| `CF_WORKER_DOMAIN_SUFFIX` | Tenant host suffix; defaults to `APP_DOMAIN` |
| `CF_WORKER_DOMAIN_ACCOUNT_ID` | Optional; defaults to `R2_ACCOUNT_ID` |
| `CF_WORKER_DOMAIN_ENABLED` | Optional `false` kill switch |

If the credentials are unset the feature is a no-op, so dev keeps working purely
on the `*.dev.paqadhr.com` route. Existing workspaces are backfilled with
`pnpm --filter api provision:tenant-domains` (`:dist` in the container;
`-- --dry-run` to preview). Cloudflare allows **100 custom domains per zone** by
default — past that, request a limit increase before onboarding more workspaces,
or move tenants behind a route plus an API proxy on a second zone.

## `CF_ROUTES` examples

## Tenant subdomains

Workspaces are served at `<slug>.<app-domain>` (`acme.paqadhr.com`, and
`acme.dev.paqadhr.com` in dev). They are **not** a Worker route:

- A `*.paqadhr.com/*` route matches every sub-host, including the API origins
  (`prod.paqadhr.com`, `api-dev.paqadhr.com`) — a route cannot exclude a
  hostname, so attaching one takes the API down.
- Instead, each tenant hostname is attached to the web Worker as a **custom
  domain**. Cloudflare then creates the DNS record and certificate, and the API
  hosts keep resolving straight to the VPS.

The API does this at workspace creation, and detaches it on permanent delete:

| Variable | Purpose |
|----------|---------|
| `CF_WORKER_DOMAIN_API_TOKEN` | Cloudflare API token (Workers Scripts:Edit + Zone:Read for the app zone) |
| `CF_WORKER_DOMAIN_ZONE_ID` | Zone the tenant hostnames live in |
| `CF_WORKER_DOMAIN_WORKER_NAME` | Worker that serves tenants (`paqadhr` in prod, `paqadhr-dev` in dev) |
| `CF_WORKER_DOMAIN_SUFFIX` | Tenant host suffix; defaults to `APP_DOMAIN` |
| `CF_WORKER_DOMAIN_ACCOUNT_ID` | Optional; defaults to `R2_ACCOUNT_ID` |
| `CF_WORKER_DOMAIN_ENABLED` | Optional `false` kill switch |

If the credentials are unset the feature is a no-op, so dev keeps working purely
on the `*.dev.paqadhr.com` route. Existing workspaces are backfilled with
`pnpm --filter api provision:tenant-domains` (`:dist` in the container;
`-- --dry-run` to preview). Cloudflare allows **100 custom domains per zone** by
default — past that, request a limit increase before onboarding more workspaces,
or move tenants behind a route plus an API proxy on a second zone.

## `CF_ROUTES` examples

- Connect the production build to branch `main` and the production Worker.
- Connect the development build to branch `dev` and the development Worker.
- Set each build's `CF_WORKER_NAME`, `CF_COMPAT_DATE`, and public URL/domain
  variables in that build's variables/secrets. Do not use one shared value set
  for both environments.
- Under each Worker’s Settings → Domains & Routes, attach the production
  domain only to the production Worker and the development domain only to the
  development Worker.

The repository validates that required values exist, but cannot inspect or
change Cloudflare dashboard settings. A domain attached to the wrong Worker
must be corrected in Cloudflare.

## Local setup

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the values
for your local setup. Do not commit `.env.local` or production secrets.
