# PaqadHR

Welcome to the **PaqadHR** monorepo. This repository contains both the backend API and the frontend web application.

---

## 🧪 For Testing (Live Demo)

Try PaqadHR without any setup:

* **Website**: [https://dev.paqadhr.com](https://dev.paqadhr.com)
* **Email**: `mbazudaniel97@gmail.com`
* **Password**: `testing321`

**Try the rewards flow (redeem airtime):**

1. Log in with the details above. The workspace has some balance
2. Go to **Shoutouts**.
3. Check your points balance.
4. Claim an **airtime reward** to your phone number.
5. Its our gift to you.

---

## 📚 Documentation

* **Product docs**: [https://hackmd.io/@mbazudaniel/paqadhr](https://hackmd.io/@mbazudaniel/paqadhr)
* **Architecture**: [https://hackmd.io/@mbazudaniel/paqadhr-architecture](https://hackmd.io/@mbazudaniel/paqadhr-architecture)

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
