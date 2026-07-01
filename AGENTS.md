# AGENTS.md

## Cursor Cloud specific instructions

PaqadHR is a pnpm + Turborepo monorepo with two dev services:

- `apps/api` — NestJS 11 API on port `9001` (PostgreSQL via TypeORM). Run: `pnpm --filter api dev`.
- `apps/web` — Next.js 16 web app on port `3000`. Run: `pnpm --filter web dev`.
- Run both together from the root: `pnpm dev` (Turbo).

Standard lint/test/build commands live in the root `package.json` and each app's `package.json` (see `README.md`). In short: `pnpm check` (Biome lint, repo-wide), `pnpm --filter api build`, `pnpm --filter api test` (Jest), `pnpm --filter web build`.

### Node version (important gotcha)

The repo requires Node >= 24, but the VM's default `node` on `PATH` is `/exec-daemon/node` (v22), which is force-prepended to `PATH` on every new shell and shadows nvm. Setup appends a line to `~/.bashrc` that prepends the nvm Node 24 bin dir, so **new interactive shells already use Node 24** — verify with `node -v`. If you ever land on Node 22 (e.g. a non-login shell), run `export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` (or `nvm use 24`).

### PostgreSQL

Postgres 16 runs locally as the `postgres` cluster. Start it if it isn't running: `sudo pg_ctlcluster 16 main start`. Databases: `paqadhr` (dev) and `paqadhr_test` (tests), both owned by role `postgres` / password `postgres` over TCP `localhost:5432`. The API auto-runs TypeORM migrations on boot (`migrationsRun: true`), so no manual migration step is needed for a fresh DB.

### API env / boot validation gotchas

`apps/api/.env` is git-ignored; copy from `apps/api/.env.example` if missing. Boot validation (`validate-env-at-boot.ts`) hard-requires `DATABASE_URL`, `ACCESS_SECRET`, `REFRESH_SECRET`, `ENCRYPTION_KEY`, the four `R2_*` vars, one of `R2_PUBLIC_ID`/`R2_CUSTOM_DOMAIN`, and `TRUSTED_ORIGINS`. The R2/Nomba/Reloadly/email values only need to be non-empty placeholders for local dev — no live connection is made at boot. Two easy-to-miss constraints: `ENCRYPTION_KEY` must be **exactly 32 characters** (the `EncryptionService` rejects any other length even though boot validation only checks `>= 32`), and `NODE_ENV=development` keeps auth cookies on `SameSite=lax` for localhost.

### Web env

`apps/web/.env.local` sets `NEXT_PUBLIC_API_URL=http://localhost:9001` (the client normalizes this to `.../api/v1`). Without it, the client defaults to `http://localhost:9001/api/v1`.

### Auth model (cross-domain caveat)

Locally, web and API share the `localhost` hostname, so the API's httpOnly auth cookies are first-party and "just work". On a split-domain deployment (web on Cloudflare, API on Dokploy) those cookies become third-party and browsers drop them. The client therefore also stores the JWTs returned in the login/register response body and sends them as `Authorization: Bearer` (the API's `jwt.strategy.ts` accepts both cookie and Bearer). Keep this dual mechanism in mind when touching auth code.
