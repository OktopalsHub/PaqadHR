---
status: accepted-for-engineering; external-accounting-review-pending
---

# Custodial Wallet Ownership and Accounting

PaqadHR models organisation custodial wallets as owned by a `Tenant` and persistent employee wallets as owned by a `User`; `TenantMember` remains the employer-specific relationship and does not determine an employee wallet's lifetime. Custodial wallets are separate from the existing rewards wallet. A new append-only, double-entry, per-currency ledger is the internal accounting record for custody funds; the existing payroll-run funding ledger remains run-level allocation and reconciliation evidence. This preserves employee ownership across employers and avoids treating rewards credits or provider snapshots as payroll cash. The schema is implemented additively; accounting review and production-data reconciliation remain rollout gates.
