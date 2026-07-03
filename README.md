# PaqadHR — Human Resources Management System Monorepo

Welcome to the **PaqadHR** monorepo. This repository contains both the backend API and the frontend web application.

---

## 🏗️ Repository Structure

This is a `pnpm` workspaces monorepo:

* **`apps/api`**: NestJS 11 backend application (runs on port `9001` in dev, uses PostgreSQL).
* **`apps/web`**: Next.js 16 frontend web application (runs on port `3000` in dev).

---

## 🚀 Getting Started Locally

### 1. Prerequisites
Ensure you have the following installed:
* **Node.js**: Version 24 or higher
* **pnpm**: Version 10 or higher (`npm i -g pnpm`)
* **PostgreSQL**: PostgreSQL 12+ (local or remote instance)

### 2. Setup Environment Variables
Clone the `.env.example` templates and set your local variables:

* **Backend (`apps/api`)**:
  ```bash
  cp apps/api/.env.example apps/api/.env
  ```
  *(Configure database URL, authentication keys, and integration secrets)*

* **Frontend (`apps/web`)**:
  ```bash
  cp apps/web/.env.example apps/web/.env
  ```
  Use the **base API URL only** (no `/api/v1` — the app appends that in `lib/api/client.ts`):
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:9001
  ```

### 3. Install Dependencies
Run from the root directory:
```bash
pnpm install
```

### 4. Running the Development Server
To start both the API and Web apps simultaneously in watch/dev mode:
```bash
pnpm dev
```
* API runs on: `http://localhost:9001`
* Web runs on: `http://localhost:3000`

### 5. Formatting & Linting
We use **Biome** for formatting and linting. Run from the root directory:
* **Check files**: `pnpm check`
* **Format and auto-fix**: `pnpm format`

---

## Deployment

### Backend API (`apps/api`) — Dokploy + GHCR

The API uses a **CI/CD Build & Publish** pipeline to keep production server resources free during builds.

* **Deployment Flow**:
  1. Pushing to `main` or `dev` branches triggers the GitHub Action `.github/workflows/api-ci.yml`.
  2. The workflow builds the Docker image and publishes it to **GitHub Container Registry (GHCR)** with branch tags (`dev`, `main`) plus `latest` and commit SHA.
  3. The workflow triggers your Dokploy Webhook to pull the image.
  4. CI prunes **untagged** GHCR manifests only — tagged images like `:dev` and `:main` are kept. Delete old tagged versions manually in GitHub Packages if the registry grows.

* **Dokploy Config**:
  * **Source Type**: `Docker Image`
  * **Docker Image**: `ghcr.io/oktopalshub/paqadhr:dev` (staging) or `:latest` / `:main` (prod)
  * **Registry**: Set up your GitHub Container Registry credentials in Dokploy.
  * **Port**: `9001`
  * **Webhook URL**: Copy this from Dokploy to your GitHub Repository Secrets as `DOKPLOY_WEBHOOK_URL`.
  * **Restore missing `:dev` tag**: push any commit to `dev` that touches `apps/api/**`, lockfiles, or `.github/workflows/api-ci.yml` so CI republishes the image.
  * **Host disk (optional)**: On the Dokploy server, schedule `docker image prune -af --filter "until=168h"` so pulled-but-unused layers do not accumulate locally. GHCR cleanup does not free space on the deploy host.

* **Rollback & zero-downtime (Dokploy Swarm Settings)**:
  The API exposes `GET /health` on port **9001** (DB readiness check). Use these in Dokploy → Advanced → Swarm Settings:

  Health check:
  ```json
  {
    "Test": ["CMD", "curl", "-f", "http://localhost:9001/health"],
    "Interval": 30000000000,
    "Timeout": 10000000000,
    "StartPeriod": 30000000000,
    "Retries": 3
  }
  ```

  Update config (zero-downtime + auto-rollback on failed health):
  ```json
  {
    "Parallelism": 1,
    "Delay": 10000000000,
    "FailureAction": "rollback",
    "Order": "start-first"
  }
  ```

  For rollback to any previous version, enable **Deployments → Rollback Settings** in Dokploy and point at your GHCR registry.

### Frontend Web (`apps/web`) — Cloudflare Workers Builds

GitHub Actions (`.github/workflows/web-ci.yml`) only **lints and build-checks**. Deploys happen via **Cloudflare Workers Builds** (git integration).

Two separate workers, same repo:

| Worker | Production branch | Domain | Build variable `NEXT_PUBLIC_API_URL` |
|--------|-------------------|--------|--------------------------------------|
| `paqadhr-dev` | `dev` | `dev.paqadhr.com` | `https://api-dev.paqadhr.com` |
| `paqadhr-prod` | `main` | `paqadhr.com` | `https://api.paqadhr.com` |

Use the **base URL only** (no `/api/v1`) — the web app normalizes it in `apps/web/lib/api/client.ts`.

**Cloudflare Build settings** (both workers):

| Setting | Value |
|---------|-------|
| Root directory | `/` (repo root — empty is fine) |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter web run cf:build` |
| Deploy command | `pnpm --filter web run cf:deploy` |
| Build watch paths | `apps/web` |
| Node.js version | 24 |

Branch routing in `cf-deploy.mjs`: `dev` → `paqadhr-dev`, `main` → `paqadhr-prod` (`wrangler deploy --env production`).

If pushes to `dev` do not deploy, check **Cloudflare → Workers → Builds → Deployments** for failed logs (missing `pnpm install` is the most common cause).
