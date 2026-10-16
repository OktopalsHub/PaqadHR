# Cloudflare Web Deploy (Workers Builds)

The web app ships to Cloudflare Workers through Workers Builds. Environment-specific
values are not embedded in the deployment scripts or Wrangler config. They must
come from the local `apps/web/.env.local` file or the variables configured for
each Cloudflare Workers Builds environment.

## How a build runs

| Stage | Command | Reads |
|-------|---------|-------|
| Build | `pnpm install --frozen-lockfile && pnpm --filter web run cf:build` | Required `CF_*` and `NEXT_PUBLIC_*` environment values |
| Deploy | `pnpm --filter web run cf:deploy` | The same environment values, via `scripts/cf-config.mjs` |

The build/deploy scripts load the app's local environment using Next.js's env
loader, then validate required values. The deploy script generates
`apps/web/.wrangler.deploy.jsonc` at deploy time and passes it to Wrangler.
The generated file is ignored by git.

## Required environment variables

Configure these separately for each branch in Cloudflare Workers Builds. The
production build should use the production values; the development build should
use the development values. Values are intentionally not provided as repository
defaults.

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
- Set each build's `CF_WORKER_NAME`, `NEXT_PUBLIC_APP_URL`, and
  `NEXT_PUBLIC_API_URL` in that build's variables/secrets. Do not use one
  shared value set for both environments.
- Under each Worker’s Settings → Domains & Routes, attach the production
  domain only to the production Worker and the development domain only to the
  development Worker.

The repository validates that required values exist, but cannot inspect or
change Cloudflare dashboard settings. A domain attached to the wrong Worker
must be corrected in Cloudflare.

## Local setup

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the values
for your local setup. Do not commit `.env.local` or production secrets.
