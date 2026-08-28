# PaqadHR

PaqadHR is an all-in-one HR platform for growing companies. One workspace to manage people, pay, time off, hiring, and recognition. Instead of juggling spreadsheets, chat threads, and separate tools, you get a single place where everything lives — payroll, leave, attendance, recruitment, peer recognition, and more.

## Documentation
* **Product docs**: [https://hackmd.io/@mbazudaniel/paqadhr](https://hackmd.io/@mbazudaniel/paqadhr)
* **Architecture**: [https://hackmd.io/@mbazudaniel/paqadhr-architecture](https://hackmd.io/@mbazudaniel/paqadhr-architecture)
* **AI agents start here**: [AGENTS.md](./AGENTS.md)
* **Security mandate (mandatory)**: [SECURITY.md](./SECURITY.md)
* **Performance rules (mandatory)**: [PERFORMANCE.md](./PERFORMANCE.md)

**Live demo**: [https://dev.paqadhr.com](https://dev.paqadhr.com)  

Try the rewards flow: log in, go to Shoutouts, check your points balance, and claim an airtime reward.

---

## System Architecture

```mermaid
flowchart LR
    Web["Web Client (Next.js)"]
    API["NestJS API"]
    DB[("PostgreSQL")]
    Nomba["Nomba (NGN payouts, billing)"]
    Reloadly["Reloadly (international rewards)"]
    Noah["Noah (USD/crypto payouts)"]
    Slack["Slack (shoutouts)"]
    Google["Google OAuth"]
    Email["ZeptoMail (emails)"]
    S3["Object storage (documents/avatars)"]

    Web --> API
    API --> DB
    API --> Nomba
    API --> Reloadly
    API --> Noah
    API --> Slack
    API --> Google
    API --> Email
    API --> S3
    Nomba -->|"webhooks"| API
    Reloadly -->|"webhooks"| API
    Noah -->|"webhooks"| API

    style Web fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
    style API fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style DB fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style Nomba fill:#451a03,stroke:#f59e0b,stroke-width:2px,color:#fff
    style Reloadly fill:#022c22,stroke:#10b981,stroke-width:2px,color:#fff
    style Noah fill:#4c0519,stroke:#ef4444,stroke-width:2px,color:#fff
    style Slack fill:#1e3a5f,stroke:#4a90d9,stroke-width:2px,color:#fff
    style Google fill:#1e1e24,stroke:#4285F4,stroke-width:2px,color:#fff
    style Email fill:#1e1e24,stroke:#EA4335,stroke-width:2px,color:#fff
    style S3 fill:#1e3a5f,stroke:#4a90d9,stroke-width:2px,color:#fff
```

The platform is built as a `pnpm` monorepo with two applications:

- **`apps/api`**: NestJS backend (TypeScript, PostgreSQL, TypeORM)
- **`apps/web`**: Next.js frontend (React, TanStack Query)

All money flows (payroll, subscriptions, rewards) are asynchronous: the API starts a payment, a webhook confirms it, and cron jobs reconcile stuck transactions.

---

## Features

### Multi-tenant workspaces

Each company gets a secure, isolated workspace. One login can belong to many workspaces. Data is scoped by `tenantId` and access is enforced at the guard layer.

```mermaid
flowchart LR
    User --> TM1["TenantMember @ Company A"]
    User --> TM2["TenantMember @ Company B"]
    TM1 --> TA["Tenant A"]
    TM2 --> TB["Tenant B"]
    TA --> DataA["All Company A data scoped by tenantId"]
    TB --> DataB["All Company B data scoped by tenantId"]

    style User fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
    style TM1 fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style TM2 fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style TA fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style TB fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
    style DataA fill:#1e1e24,stroke:#3d3d3d,stroke-width:2px,color:#fff
    style DataB fill:#1e1e24,stroke:#3d3d3d,stroke-width:2px,color:#fff
```

### Payroll processing with manual and gateway disbursement

Create payroll runs, calculate salaries, approve, and pay out. Supports manual disbursement (mark as paid offline) and gateway disbursement through Nomba (NGN) or Noah (USD/crypto). Webhooks update payment status automatically.

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant Nomba
    participant DB

    Admin->>API: Create payroll run (period, employees)
    API->>DB: Save run (status: draft)
    Admin->>API: Calculate (add adjustments)
    API->>DB: Store items with net amounts
    Admin->>API: Approve run
    API->>DB: Status: processing -> approved
    Admin->>API: Process multi-payment
    loop each payroll item
        API->>Nomba: createPayment (bank transfer)
        Nomba-->>API: accepted (async)
    end
    Nomba->>API: POST /webhooks/nomba (transfer status)
    API->>API: applyTransferStatus -> paid/failed
    API->>DB: Update item + reconcile run
```

### Peer shoutouts and Paq Points

Send recognition to colleagues with a message and core-value category. Points are debited from the sender's monthly allowance and credited to each recipient's balance. Recipients can spend points on rewards (airtime, gift cards, custom perks).

```mermaid
sequenceDiagram
    participant Sender
    participant API
    participant DB
    participant Recipient

    Sender->>API: POST /shoutouts (recipients + points)
    API->>DB: Validate allowance & limits
    API->>DB: Deduct sender points, credit recipients
    API->>DB: Create shoutout + transaction records
    API-->>Sender: Shoutout created
    API->>API: Emit shoutout.created event
    API->>Slack: Broadcast (if configured)
    API->>Recipient: In-app notification
```

### Subscription billing (per-seat pricing)

Workspaces subscribe to plans with per-user pricing. Billing flows through Nomba (tokenized card). Renewals are charged via a daily cron, with dunning retries and a grace period before suspension.

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant Nomba
    participant Cron

    Admin->>API: Create checkout (plan + seat count)
    API->>Nomba: createCheckoutOrder (tokenize card)
    Nomba-->>API: Checkout URL
    Admin->>Nomba: Complete payment
    Nomba->>API: POST /webhooks/nomba (payment_success)
    API->>DB: Activate subscription (7-day trial supported)
    Cron->>API: Daily renewal check
    API->>Nomba: chargeRenewal (saved card)
    Nomba-->>API: Result (success/fail)
    API->>DB: Update subscription + billing history
```

---

## Technologies Used

| Technology | Description |
|------------|-------------|
| [NestJS](https://nestjs.com/) | Backend framework (Node.js) |
| [TypeScript](https://www.typescriptlang.org/) | Language |
| [PostgreSQL](https://www.postgresql.org/) | Database |
| [TypeORM](https://typeorm.io/) | ORM |
| [Next.js](https://nextjs.org/) | Frontend framework |
| [React](https://reactjs.org/) | UI library |
| [TanStack Query](https://tanstack.com/query) | Data fetching |
| [pnpm](https://pnpm.io/) | Package manager |
| [Turbo](https://turbo.build/) | Monorepo orchestration |
| [Biome](https://biomejs.dev/) | Linting and formatting |
| [ZeptoMail](https://www.zoho.com/zeptomail/) | Email delivery |
| [Nomba](https://nomba.com/) | NGN payments and billing |
| [Reloadly](https://www.reloadly.com/) | International gift cards and top-ups |
| [Noah](https://noah.com/) | USD/crypto payouts |

---

## Quick Start

Clone the repository and set up the development environment:

```bash
git clone https://github.com/OktopalsHub/PaqadHR.git
cd PaqadHR
pnpm install
```

Copy environment template files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Configure your PostgreSQL connection and other secrets in `apps/api/.env` (and web vars in `apps/web/.env`). Variable descriptions live in `apps/api/.env.local.example` and `apps/web/.env.local.example`. Then start both apps:

```bash
pnpm dev
```

- API runs on `http://localhost:9001`
- Web runs on `http://localhost:3000`

For full setup instructions, see the [apps/api/README.md](https://github.com/OktopalsHub/PaqadHR/blob/main/apps/api/README.md).

---

## Author

**Daniel Mbazu**  
Backend Engineer & Lead Developer  
[GitHub](https://github.com/mbazu-daniel)  
Email: mbazudaniel97@gmail.com

---

## Badges

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turbo](https://img.shields.io/badge/Turbo-000000?style=for-the-badge&logo=turborepo&logoColor=white)](https://turbo.build/)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://dokugen.samueltuoyo.com)