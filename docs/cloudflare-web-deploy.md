# Cloudflare Web Deploy (Workers Builds)

The web app ships to Cloudflare Workers through **Workers Builds** (the connected
build per branch). Nothing about a build's target is hardcoded in the repo: the
worker name, vars, routes and compatibility date all come from that build's
environment variables, so `dev`, `main` and the production worker are deployed
from the same code with no per-branch config in git.

## How a build runs

| Stage | Command (set in the build configuration) | Reads |
|-------|------------------------------------------|------|
| Build | `pnpm install --frozen-lockfile && pnpm --filter web run cf:build` | `NEXT_PUBLIC_*` env vars (inlined at build time) |
| Deploy | `pnpm --filter web run cf:deploy` | the same env vars, via `scripts/cf-config.mjs` |

`cf:deploy` resolves the wrangler config from the environment, writes it to
`apps/web/.wrangler.deploy.jsonc` (git-ignored, regenerated every deploy) and
runs `opennextjs-cloudflare deploy --config … --keep-vars`.
`apps/web/wrangler.jsonc` is only the static baseline for local
`wrangler dev` / `pnpm cf:preview`.

## Build environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `CF_WORKER_NAME` | optional | Worker to deploy to. Defaults per branch: `paqadhr` on `main`, `paqadhr-dev` everywhere else (`dev`, previews). Set it to override — and make it match the Worker the build is connected to, otherwise Workers Builds overrides it and warns. |
| `NEXT_PUBLIC_API_URL` | yes | API origin used by the app (`https://api-dev.paqadhr.com`, `https://api.paqadhr.com`, …). |
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

## `CF_ROUTES` examples

Attach a custom domain and/or a zone route:

```bash
CF_ROUTES=[{"pattern":"dev.paqadhr.com","custom_domain":true},{"pattern":"*.dev.paqadhr.com/*","zone_name":"paqadhr.com"}]
```

Key the value as a single line — the variable is parsed as JSON.
Leaving it empty deploys with no routes, which is the safest default: adding a
`custom_domain` route requires the API token to see the `paqadhr.com` zone, and
a missing zone fails the whole deploy (this is what broke earlier deploys).
Prefer attaching custom domains in the Cloudflare dashboard
(Workers → Settings → Domains & Routes) when you do not need them in sync
with the repo.

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Could not find zone for paqadhr.com` | A `custom_domain`/`zone_name` route was deployed with a token that cannot see the zone | Remove `CF_ROUTES` (dashboard domains instead) or use a token with zone access |
| Worker name mismatch warning | `CF_WORKER_NAME` differs from the Worker the build is connected to | Set `CF_WORKER_NAME` to the connected Worker's name |
| Build id shows `dev` | No `NEXT_PUBLIC_APP_BUILD_ID`/`GITHUB_SHA`/`WORKERS_CI_COMMIT_SHA` | Set `NEXT_PUBLIC_APP_BUILD_ID` (e.g. the commit SHA) |
| `CF_WORKER_NAME is required for main builds` | (legacy) Main build without a target worker | No longer required — `main` defaults to the `paqadhr` worker. Set `CF_WORKER_NAME` only to override |
