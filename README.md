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
  Create a `.env.local` inside `apps/web/` if you need to override public api endpoints:
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

## 🛳️ Deployment (Dokploy)

Both applications are configured for deployment on **Dokploy** via Docker containers.

### 1. Backend API (`apps/api`)
The API uses a **CI/CD Build & Publish** pipeline to keep production server resources free during builds.

* **Deployment Flow**:
  1. Pushing to `main` or `dev` branches triggers the GitHub Action `.github/workflows/api-ci.yml`.
  2. The workflow builds the Docker image and publishes it to **GitHub Container Registry (GHCR)** as `ghcr.io/oktopalshub/paqadhr:latest`.
  3. The workflow triggers your Dokploy Webhook to pull the latest image.

* **Dokploy Config**:
  * **Source Type**: `Docker Image`
  * **Docker Image**: `ghcr.io/oktopalshub/paqadhr:latest`
  * **Registry**: Set up your GitHub Container Registry credentials in Dokploy.
  * **Port**: `9001`
  * **Webhook URL**: Copy this from Dokploy to your GitHub Repository Secrets as `DOKPLOY_WEBHOOK_URL`.

### 2. Frontend Web (`apps/web`)
The web application can be built directly on your server or via a similar Docker flow.

* **Dokploy Config (Git Deployment)**:
  * **Source Type**: `Git`
  * **Build Type**: `Dockerfile`
  * **Dockerfile Path**: `apps/web/Dockerfile`
  * **Root Directory (Build Path)**: `/` (Must be `/` to allow access to root `pnpm-lock.yaml`)
  * **Port**: `3000`
