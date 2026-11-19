# Payment, Wallet, and Payroll Overhaul

## Payroll architecture deepening

**Status:** In progress. The user approved all three architecture recommendations and the recommended design choices below. Keep this tracker current as implementation proceeds.

### Implementation progress — 2026-11-10

- Added durable funding and payout attempt entities, tenant/run/item validation, lifecycle transition rules, idempotency/provider-reference constraints, and a backfill migration for legacy metadata, Bridge wallet operations, and payroll-item references.
- Wired ordinary payroll checkout creation and provider-confirmed completion to funding-attempt history. The retired legacy retry-funding write path is not being reopened; its old references are preserved for historical webhook/reconciliation handling.
- Wired Bridge and Nomba payout submission claims to durable attempt creation in the same database transaction. Reconciliation updates the attempt record and keeps legacy provider lookups in the read/recovery path.
- Retry reconciliation now fails closed when Nomba cannot confirm the prior transfer's status; only provider-confirmed terminal failures may receive a new merchant reference. Explicit item selections must belong to the tenant's payroll run and still be failed. Bridge bank-payout retries continue through the existing completed wallet-transfer leg and retry only the employee-wallet withdrawal.
- Legacy retry-checkout webhooks, late payments, reconciliation, and cancellation now transition the migrated retry funding attempt after provider verification and run-ledger recording. New per-retry Bachs checkouts remain retired; Bridge retries reserve from the organization's existing wallet, and NGN retries use the existing Nomba-funded run balance.
- Restored the platform-admin cancel action for already-existing retry checkouts so support can safely reconcile/release those records; it does not reopen tenant-facing legacy checkout creation.
- Renamed `PayrollFloatTopupService` to `PayrollFundingService`; the service still contains legacy compatibility/reconciliation responsibilities and needs a deeper extraction after migration behavior is established.
- Remaining: split funding and payout lifecycle responsibilities further; confirm the Nomba account's settlement-balance and failed-transfer recovery behavior for retries; review late-reversal accounting because payout attempt status can be marked reversed while the run funding ledger has no reversal event; verify the migration against the deployed schema; do not treat API compilation as production or accounting approval.

### Agreed module responsibilities

- Payroll funding owns ordinary payroll funding and retry-shortfall funding as one lifecycle. Each checkout attempt must be persisted explicitly; `PayrollRunFundingLedgerEntry` remains allocation/reconciliation evidence and is not replaced by attempt records.
- Payroll payout lifecycle owns shared per-item state, idempotency, and recovery across Bridge and Nomba. Provider-specific transfer steps remain in their adapters. Durable payout-attempt history is retained for both providers; Bridge `WalletOperation` rows remain evidence for Bridge wallet legs.
- Payout reconciliation remains a separate module. It may query legacy providers only to resolve already-submitted historical payouts; new submissions remain Bridge for non-NGN and Nomba for NGN. Keep original provider references and retire legacy read adapters only after unresolved payouts are reconciled.
- `WalletLedgerService` remains the custody accounting record. Neither payroll funding attempts nor payroll payout attempts become wallet-ledger entries by themselves.

### Implementation sequence

- [ ] Add an explicit, tenant-scoped payroll-funding-attempt record and migrate ordinary plus retry funding reads/writes without removing the run-funding ledger.
- [ ] Deepen the payroll-funding lifecycle around the current caller seam; keep provider checkout and legacy reconciliation details local to adapters.
- [x] Add durable payroll-payout-attempt history for Bridge and Nomba and make per-item idempotency/recovery use that record as the shared attempt trail. Bridge and Nomba submissions create tenant/run/item-scoped attempts in the same transaction as the item claim; provider status reconciliation updates the recorded attempt.
- [ ] Deepen the shared payout lifecycle while preserving Bridge wallet-leg records, Nomba direct bank transfers, partial run outcomes, and provider-specific success boundaries.
- [x] Keep reconciliation separate; make legacy provider lookups read-only for existing references and remove any new-submission path through them. New payout orchestration is Bridge/Nomba; legacy provider resolution remains in the reconciliation/query path for stored references.
- [ ] Add or update minimal behavior checks for lifecycle invariants; run them only when implementation verification is requested.
- [ ] Review tenant scoping, constraints, webhook idempotency, query selectivity, bounded batches, and migration rollback behavior before rollout.

**Status:** Bridge is the provider for non-NGN payroll wallets and payouts; Nomba handles NGN payroll checkout and bank transfers behind its approval and fee gates. Bridge organization/member wallet funding, stablecoin transfers, and USD/EUR/GBP bank payout orchestration use reservations and transfer reconciliation. Payroll preflight now reads organization Bridge wallet balances and estimates required source assets per network, including the existing FX buffer and plan fee. These FX estimates are indicative, not locked quotes. The active plan's 3%, 2.5%, or 2% PaqadHR payroll fee is separate from Bachs subscription billing. Stablecoin payouts submit the plan fee as a Bridge developer fee behind an explicit settlement-configuration gate. Bridge routes remain disabled unless exact account-specific capability entries are configured; Nomba NGN remains disabled until the account is approved and its confirmed transfer fee is configured. NGN checkout fees, locked FX quotes, account-specific route approval, and production reconciliation remain open.
**Last updated:** 2026-11-09  
**Scope:** Working roadmap for the provider policy, code audit, wallet ledger, and payroll migration. Update the checklist as implementation and account approvals progress.

**Phase 2 status:** Initial provider-customer, chain-specific custodial-wallet, exact-decimal ledger-account, journal transaction/entry, funding, webhook-event, external-account, and money-operation schema has been added in additive migrations. The ledger service posts atomically, validates currency-balanced entries without floating point, supports idempotent repeats and reversal journals, and the database rejects unbalanced posted transactions and mutation of posted evidence. Bridge organization and employee onboarding, wallet provisioning, balance snapshots, and owner-scoped virtual-account creation/read endpoints are implemented. Signed, replay-limited, idempotent Bridge webhooks record virtual-account funding lifecycle events, credit only `payment_processed` deposits to the matching owner's ledger, reverse confirmed funding refunds, and settle employee transfers only at `payment_processed`. New payroll processing no longer uses the legacy provider factory/batching or provider-float checkout; scheduled runs also use Bridge wallet payouts. USDC/USDT same-asset wallet transfers and USD/EUR/GBP employee-owned bank payouts are implemented behind exact capability entries. NGN payroll uses the separate Nomba checkout and bank-transfer route; Bridge NGN remains unsupported. Production provider approval and account-specific enablement, accounting review, deployed-schema verification, and production-data reconciliation remain open.

**Implementation authorization:** User has directed implementation of a production-quality payroll path targeting USD, EUR, GBP, NGN, USDT, and USDC, accepting that unapproved routes may be removed later. Implement support behind explicit provider capability gates; never claim an unconfirmed rail is live or silently route it through another provider.

## Implementation execution tracker

- [x] Finalize the initial provider-neutral ownership and ledger schema; add a reversible-empty-only TypeORM migration. Production accounting review remains open.
- [x] Complete Bridge customer, wallet, funding, transfer, and webhook adapters with boundary validation, idempotency, and reconciliation. Implemented: API client, onboarding/status refresh, wallet creation/balance APIs, exact route capability configuration, funding/reversal journals, employee external accounts, stablecoin and bank payout stages with reservations, signed transfer events, and status replay. Open: account-specific approval and full reconciliation reporting.
- [x] Receive and verify Bridge webhooks using the raw request body, public-key signature, timestamp window, event deduplication, and retryable processing claims.
- [x] Persist organization/member virtual-account deposits and credit the owner's internal ledger only after Bridge reports `payment_processed`; preserve refunds as reversal journals.
- [x] Add organization and employee virtual accounts that deposit into the matching owner's Bridge wallet; persist only the owner/provider mapping and retrieve bank instructions from Bridge through owner-scoped endpoints.
- [x] Connect confirmed organization virtual-account funding to owner ledger balances and connect approved payroll runs to per-employee Bridge wallet-transfer operations and reservations.
- [x] Add Bridge external-account creation and USD/EUR/GBP employee bank payouts. Routes fail closed unless exact Bridge withdrawal and wallet-transfer capabilities are configured; there is no legacy-provider fallback. Payroll uses Bridge's indicative rates for USD/EUR/GBP and retains the quote timestamp. Rates are not locked quotes. Bridge NGN payouts and USDC↔USDT conversions remain unsupported.
- [ ] Replace estimated legacy payout-fee reserves with a preflight quote/fee flow for Bridge. Plan-based PaqadHR charges now use Bridge developer fees for stablecoin payouts and leave employee net pay unchanged; Bridge holds these fees and settles monthly, so ledger treatment is a fee receivable. Actual Bridge receipt fee fields are captured on settled transfers. Bridge does not publish a locked fee quote; supported account-specific transfer fee details still require a preflight design with Bridge.
- [x] Keep the plan-based PaqadHR payroll charge distinct from Bachs subscription billing, and calculate/aggregate payroll fees with the same exact-decimal per-item rounding used by payout reservations. The preview now loads the tenant plan once for the whole batch.
- [x] Implement employee bank payouts as a customer-owned wallet-to-external-account flow, with employee Bridge external-account provisioning, idempotent multi-stage payroll status, and settlement reconciliation. Bridge's off-ramp requires the same customer to own the wallet and external account, so payroll first credits the employee's personal Bridge wallet and then pays the linked bank account. The implementation checks current Bridge external-account status before withdrawal. Exact routes still require Bridge account enablement and exact capabilities; Bridge NGN remains disabled because it is absent from the documented routes.
- [x] Add explicit capability parsing for USD, EUR, GBP, NGN, USDT, and USDC across operation, source/destination currency, country, and network. Routes are disabled unless an exact tuple is configured.
- [x] Restrict new payroll payout initiation to Bridge; keep Bachs retry-funding submissions retired and block retries for legacy-provider items until their original outcome is reconciled. Preserve old-provider status reconciliation for already-submitted items.
- [x] Route NGN payroll through a distinct Nomba checkout and individual employee bank transfers, with the configured Nomba payout-fee reserve plus PaqadHR's ₦50 per-transfer charge. Enablement remains gated on Nomba approval and the confirmed account tariff.
- [x] Add Bridge funding preflight to the payroll confirmation response and UI. It aggregates required stablecoin source assets by network, reads organization wallet balances, includes the same bank FX buffer and plan fee as payout orchestration, and does not combine unlike currencies into one shortfall figure. Bridge preflight is an estimate; it does not lock FX or confirm final provider fees.
- [ ] Remove Monnify/Noah/Fincra adapters and configuration from remaining non-payroll flows after their transactions and webhooks are resolved; keep Bachs for subscriptions and Nomba for Nigerian shout-out/rewards purchases.
- [ ] Update client/API contracts and operational docs for balances, funding status, payout status, and unsupported routes.
- [ ] Review security, migrations, provider docs, and static/type-level checks. Do not enable production routes without Bridge/Bachs account approval and reconciliation readiness.

## Target provider policy

| Business purpose | Intended provider | Current status |
|---|---|---|
| Organisation payroll wallets, employee wallets, payroll funding and payouts | Bridge | Nigeria is accepted as an intended launch market based on user confirmation; PaqadHR account entitlement, rails, and product capabilities still need confirmation |
| Subscription checkout and billing lifecycle | Bachs | User-confirmed target; current code also permits Nomba and Monnify; NGN recurring subscription enablement is unconfirmed |
| Nigerian rewards purchases (such as airtime, data, and utilities) | Nomba | User-confirmed target; separate rewards wallet funding still needs a provider decision |
| All payment operations | Retire Monnify, Noah, and Fincra completely | User-requested retirement across all flows; migrate/disable each use and reconcile in-flight records first |

Provider routing must be based on business purpose and supported operation. Currency or country fallbacks must not silently send payroll to Nomba/Bachs or subscriptions to Nomba/Monnify. Nomba's intended retained use is Nigerian rewards purchases, separate from rewards wallet funding.

## Phase 0 — Provider and product confirmation

### Confirm the policy

- [x] Confirm the target provider for new subscription checkout and billing: Bachs.
- [x] Confirm the target provider purpose for Nomba: Nigerian rewards purchases, not shout-out feature payments.
- [x] Clarify that the Nigerian rewards-purchase scope includes the existing airtime, data, and utility reward redemptions.
- [ ] Confirm whether existing Nomba/Monnify subscriptions should be grandfathered until expiry/cancellation or migrated to Bachs checkout (which may require customer re-consent/payment method).
- [ ] Confirm NGN recurring subscription capability is enabled for PaqadHR's Bachs account; PaqadHR plan data contains NGN recurring prices.
- [ ] Confirm Bachs must support all current subscription regions, currencies, renewals, cancellations, refunds, and payment-failure handling.
- [x] Set unsupported payroll/wallet routes to fail closed. Do not fall back to Bachs or Nomba; Bridge is the payroll/wallet provider in the target policy.

### Bridge capability and commercial confirmation

- [x] Record Nigeria as an intended market based on the user's confirmation and Helicode as a peer example.
- [ ] Confirm PaqadHR's specific Bridge account/program eligibility, onboarding, KYC/KYB, terms acceptance, custody model, and production access. A peer's availability does not establish PaqadHR account entitlements.
- [x] Confirm public product model includes business and individual customer records and custodial wallets for the payroll flow.
- [ ] Confirm Bridge permits persistent employee wallet ownership and employer-to-employee transfers under PaqadHR's account/program; document `on_behalf_of` requirements.
- [ ] Confirm deposit/funding methods, virtual account availability, settlement states, fees, limits, and reversals for each launch country/currency. Public docs show USD/EUR employer virtual-account payroll flow.
- [ ] Confirm USD, EUR, and GBP funding and payout routes, and USDC/USDT networks for custody, wallet transfers, and withdrawals. Public fiat routes list USD ACH/FedNow/Wire, EUR SEPA, and GBP Faster Payments; exact PaqadHR routes and token/network matrix remain open.
- [ ] Confirm NGN funding and payout separately. Nigeria market eligibility does not establish NGN fiat-rail support.
- [x] Review public webhook signature and idempotency requirements: raw-body/public-key signature verification, event IDs, delivery retries, and idempotency keys are documented.
- [ ] Confirm enabled webhook event types, sandbox/live behavior, and account-specific status-query access.
- [ ] Confirm FX quote lifetime, fees, amount precision, transfer limits, and what happens when a transfer times out after provider acceptance.
- [x] Record public Bridge documentation findings and source links in [bridge-capability-research.md](./bridge-capability-research.md).
- [ ] Record account-specific evidence/links, Bridge contact/account owner, and date for each provider answer.

### Phase 0 exit criteria

- [ ] Approved provider-by-purpose / operation / country / currency capability matrix.
- [ ] Approved treatment for existing subscriptions, pending transactions, and unsupported routes.
- [ ] Written confirmation of Bridge launch scope and any operational/compliance blockers.
- [ ] Bachs confirmation of NGN recurring subscription enablement and treatment of active Nomba/Monnify subscriptions.

## Phase 1 — Codebase and data audit

### Repository flow inventory

- [x] Read repository security and performance requirements: `SECURITY.md`, `PERFORMANCE.md`, root `AGENTS.md`.
- [x] Locate primary payroll orchestration, provider factory/adapters, billing resolver, webhooks, payment-method logic, and wallet/rewards funding paths.
- [x] Trace the primary live provider paths from service/controller through provider completion and persisted records. Per-flow map below; production runtime state remains unverified.
- [x] Search deployment/environment docs and scripts for provider configuration and identify runtime consumers.
- [x] Build an initial provider-by-flow inventory with target disposition; account-specific and migration exceptions remain open.

### Data and migration inventory

- [x] Identify the existing `PayrollRunFundingLedgerEntry` append-only ledger and payroll webhook event model.
- [x] Map payroll runs/items, payment methods, reward wallet funding, subscription billing records, provider references, and ledger entries at the entity level.
- [x] Identify balance semantics at the code/model level: rewards wallet `balance_amount` is an internally updated rewards balance; payroll run available funds are derived from its funding ledger plus provider/float checks; Bridge custody balances will need provider reconciliation. Production snapshots remain uninspected.
- [x] Inventory key entity-level unique constraints, idempotency keys, provider references, webhook event deduplication, and tenant-scoped indexes.
- [x] Review current migration constraints/retention at source level: payroll funding idempotency is unique, payroll webhook `(provider,event_id)` is unique, tenant/run indexes and restrictive FKs exist, and the original funding-ledger down migration refuses to drop populated financial records.
- [ ] Verify the applied constraints and migrations against the deployed schema.
- [x] Draft the relationship: new custody ledger is authoritative for custody funds; payroll-run ledger remains run-level allocation/reconciliation evidence linked to it. Accounting review remains open.
- [x] Identify historical provider value fields in payroll items, subscriptions, webhook events, rewards transactions, and provider-specific metadata; preserve these values for audit/reconciliation.
- [ ] Review production/staging data for pending, processing, retryable, or disputed transactions for providers slated for retirement. Requires a read-only production/staging query or a sanitized export; no such access/data was available in this audit. Record counts and safe resolution procedures; do not expose PII in this plan.

### Static provider flow map

| Flow | Initiation and provider selection | Completion/reconciliation | Records and migration implication |
|---|---|---|---|
| Subscriptions | `SubscriptionCheckoutService` → `BillingProviderFactoryService` → Bachs, Nomba, or Monnify by region/configuration | Subscription webhook dispatcher/service; provider-specific parsing and payment verification | `TenantSubscription` and `BillingEvent`; Bachs-only target must address NGN plan enablement and active legacy subscriptions |
| Payroll run funding | `PayrollFundingService` selects the approved payroll route; checkout/funding confirmation enters through provider webhooks | `PayrollFundingService` verifies provider status and records run funding | `PayrollFundingAttempt` preserves checkout lifecycle; `PayrollRunFundingLedgerEntry` remains run allocation/reconciliation evidence; custodial deposits remain in `WalletFunding` and the wallet ledger |
| Payroll employee payouts | `MultiPaymentService` + `PaymentProviderFactoryService`, with provider selection by currency/payment method/network | Provider webhook/status query and payout reconciliation/cron | `PayrollItem` provider/status/reference and payroll funding ledger; Bachs/Noah/Fincra/Nomba/Monnify all require disposition |
| Rewards wallet funding | `resolveRewardsWalletPaymentProvider` → checkout adapter or saved-card charging; supports configured NG/international choices, including Bachs/Noah/Fincra/Monnify/Nomba paths | Provider webhook verifies checkout/charge before wallet credit | `TenantWallet` balance + `TenantWalletTransaction`; separate rewards balance requires an explicit provider target and no conversion to custody ledger |
| Nigerian rewards purchases | Rewards claim fulfillment uses Nomba or Monnify for airtime/data and electricity; provider selection can prefer Monnify | Synchronous result or pending provider result updates redemption status | `RewardRedemption` stores amount, status, and provider transaction ref; target Nomba-only means remove Monnify selection after confirming Nomba coverage |
| Nigerian bank lookup/payment method | `NigerianBankService` aggregates/tries Bachs, Monnify, and Nomba bank-list/account-resolution APIs | Synchronous lookup; verified destination saved to employer-scoped payment method | `PaymentMethod` belongs to `TenantMember` + `Tenant`; decide retained lookup source and do not conflate this with custodial employee wallets |
| Provider webhooks | Public provider-specific endpoints dispatch to the above domains | Raw-body signature verification; event deduplication differs by subsystem/entity | Keep old provider endpoints active until all associated in-flight operations are terminal and their records are reconciled |

### Phase 1 exit criteria

- [x] Static code flow map for each active provider purpose and completion path (see table above).
- [ ] In-flight transaction inventory and resolution path for each retiring provider.
- [ ] Reviewed ownership, schema, migration, and ledger compatibility decisions before schema implementation.

## Initial repository findings (2026-11-07)

These are code-inspection findings, not production transaction counts or provider capability confirmations.

- Payroll currently has multi-provider payout orchestration, a provider factory, payout webhooks, and reconciliation paths for Nomba, Noah, Fincra, Monnify, and Bachs.
- Bachs has payroll-float funding/payout logic and is referenced by payment-method validation; it is also used for wallet top-up and saved-card flows outside subscriptions.
- Subscription billing currently resolves among Nomba, Monnify, and Bachs. The resolver includes regional allowlists and configuration fallback; this conflicts with Bachs-only subscriptions.
- Nomba is used in payroll, subscription billing, Nigerian bank lookup, and Nigerian rewards purchases. The user clarified that “Nomba for shout-outs” means rewards purchases, not the shout-outs feature.
- The rewards wallet provider resolver currently routes Nigerian wallet checkout through the NG wallet provider config, routes USD to Bachs when configured, and uses an international provider resolver for other non-NGN wallet deposits. This means restricting Bachs to subscriptions requires a replacement/retirement decision for rewards wallet deposits too.
- Nomba and Monnify both support rewards airtime/data/utility fulfillment. The user clarified that Nomba's intended role is Nigerian rewards purchases; confirm whether Nomba remains for all these purchase types. The separate rewards wallet funding flow still needs a provider decision.
- Monnify, Noah, and Fincra have live adapters/configuration and webhook/reconciliation code. Monnify also appears in subscription billing, Nigerian bank lookup, rewards wallet funding, airtime/utility fulfillment, and related provider handling; these uses need disposition before removal. Noah/Fincra are wired into payroll and international rewards wallet routes.
- `PayrollRunFundingLedgerEntry` records funding received, payout reservations/confirmations, reservation releases, and shortfall approvals/cancellations. It is append-only and is scoped by tenant and payroll run. It does not by itself establish a general organisation/employee wallet ledger.
- The repository uses TypeORM entities and migrations (not Prisma), so proposed data changes must follow existing TypeORM conventions.
- A repository search is not a substitute for checking live production/staging transaction state or deployment secrets; those inventories remain open.

### Initial provider-by-flow inventory

| Provider | Code paths found | Proposed disposition / open work |
|---|---|---|
| Bridge | No existing provider adapter found in the searched API provider/config paths | Add for wallets and payroll after Phase 0 capability confirmation |
| Bachs | Subscriptions; payroll float funding and payout; payment-method validation; rewards wallet checkout/top-up and saved-card charge; provider webhooks | Keep subscriptions; migrate/retire all other responsibilities before claiming subscription-only |
| Nomba | Payroll; subscription billing; Nigerian bank lookup; rewards wallet checkout; airtime/data/utility fulfillment; payment webhooks | Retain Nigerian rewards purchases per user clarification; decide whether all purchase types stay and explicitly decide all other uses, including rewards wallet funding |
| Monnify | Payroll; subscription billing; Nigerian bank lookup; rewards wallet checkout; airtime/data/utility fulfillment; webhooks | Retire only after each flow is migrated/disabled and in-flight activity resolved |
| Noah | International payroll; rewards wallet checkout; webhooks/reconciliation | Retire only after each flow is migrated/disabled and in-flight activity resolved |
| Fincra | International and NG payroll; rewards wallet checkout; payout/webhook/reconciliation paths | Retire only after each flow is migrated/disabled and in-flight activity resolved |

## Decision and evidence log

| Date | Item | Current result | Evidence / next action |
|---|---|---|---|
| 2026-11-07 | Target roles requested | Bridge payroll/wallets; Bachs subscriptions; Nomba Nigerian rewards purchases; retire Monnify/Noah/Fincra | User-provided direction; awaiting Phase 0 capability and scope confirmations |
| 2026-11-07 | Nomba retained flow | User clarified this means Nigerian rewards purchases | Treat NGN airtime/data/utility redemptions as target Nomba flows; still decide the distinct rewards wallet funding path |
| 2026-11-07 | Bridge public capability review | Payroll guide covers business employer and individual employee customers, wallets, USD/EUR funding, per-employee transfers, and idempotency; public fiat route list does not list NGN | [Bridge research](./bridge-capability-research.md); account eligibility, exact token/network matrix, and account-specific routes remain unconfirmed |
| 2026-11-07 | Nigeria launch market | User confirms Nigeria is allowed and cites Helicode as a peer using Bridge | Treat Nigerian onboarding as the target assumption; public material found confirms Helicode offers stablecoin payroll but did not independently identify its payment provider; NGN rail support remains unconfirmed |
| 2026-11-07 | Bachs NGN subscription capability | Official guidance says NGN subscriptions are not generally enabled and depend on account configuration; PaqadHR has NGN recurring plan prices | Confirm PaqadHR account enablement and treatment of active Nomba/Monnify subscriptions |
| 2026-11-07 | Phase 2 data model audit | TypeORM entities identified; rewards balances and payroll funding records are separate domains | Compatibility/backfill design and production semantics remain open |
| 2026-11-07 | Production transaction inventory | Not inspected | Requires read-only production/staging payment-state inventory before disabling webhooks/providers |

## Later rollout roadmap (not started)

1. Add Bridge provider capabilities behind narrow operation-specific interfaces.
2. Pilot organisation and persistent employee wallets with strict owner/tenant boundaries.
3. Move payroll funding and employee payouts to Bridge with idempotency and reconciliation.
4. Restrict Bachs to subscriptions and Nomba to the confirmed Nigerian rewards-purchase flows.
5. Retire Monnify, Noah, and Fincra after in-flight transactions are resolved and historical records remain readable.
6. Roll out gradually with transaction-level reconciliation and operational monitoring.

## Phase 2 — Wallet ownership and ledger foundation (design in progress)

### Current model facts

- `Tenant` is the organisation/workspace. `TenantMember` is a membership/employment relationship between one `Tenant` and one `User`; a user can have multiple tenant memberships.
- `TenantWallet` and `TenantWalletTransaction` in the rewards module are the existing tenant rewards-spending balance. They have a mutable `balance_amount` and rewards-specific top-up/spend/refund behavior. They are not a Bridge custody wallet and must not be repurposed as payroll funds.
- Payroll does not currently have one general organisation wallet balance. `PayrollRunFundingLedgerService` calculates run-level funding/reservation state, while `PayrollFloatBalanceService` and provider APIs supply external float/account state. This is run-scoped and provider-dependent, not a reusable tenant custody-wallet ledger.
- Payroll currently records run-scoped funding and payout allocation events in `PayrollRunFundingLedgerEntry`. Its entries are append-only and include payout reservation events, but this is not a general wallet balance ledger.
- The funding ledger is consumed by payroll float top-up/preflight, payout orchestration/retries, reconciliation, and admin/payout ledger endpoints; reconciliation also queries the table directly. Replacing or changing it requires coordinated migration of these paths, not only the ledger service.
- `PaymentMethod` is scoped to both `Tenant` and `TenantMember`; it represents employer-specific payout destinations and should not be repurposed as employee wallet ownership. `TenantSubscription` stores a provider enum plus legacy provider-specific columns/metadata. `PlanPrice` contains USD and NGN prices plus a Bachs product ID, so Bachs NGN recurring billing needs account confirmation.
- `BillingEvent` and payroll webhook events deduplicate on `(eventId, provider)`. Rewards wallet transactions store provider event/reference values, but the entity declares no unique index on either. Any wallet migration must preserve webhook deduplication and explicitly address rewards top-up uniqueness without changing reward balances casually.
- `PayrollRun` belongs to a tenant; `PayrollItem` points to a `TenantMember`. A persistent employee-owned wallet should therefore be associated with the person (`User`), not a single employer membership (`TenantMember`).
- The application uses TypeORM and PostgreSQL migrations. The initial proposal's Prisma terminology is not applicable.
- Official Bachs guidance describes recurring billing and renewal retries, but says NGN recurring subscriptions are only available when enabled for an account. PaqadHR has NGN recurring plan prices, making account enablement a blocker to a Bachs-only subscription cutover. [Bachs subscription release](https://bachs.userjot.com/updates/p/subscriptions-are-live), [Bachs Nigeria subscription guidance](https://bachs.io/blog/how-to-charge-usd-subscriptions-from-nigeria).

### Proposed ownership model (pending review)

- **Organisation wallet owner:** one `Tenant`.
- **Employee wallet owner:** one `User`, allowing the same employee wallet to remain theirs across employers and memberships.
- **Membership:** an authorization and payroll relationship only; it does not own or determine the lifetime of an employee wallet.
- **Rewards wallet:** the existing tenant rewards-spending balance, separate from custodial payroll wallets.
- **Provider wallet:** one chain-specific Bridge wallet, owned by one tenant or user. Bridge can report multiple asset balances for a wallet, so token/currency balances live in separate ledger accounts rather than duplicate provider-wallet rows.
- Every wallet identity must have exactly one owner. The schema enforces the tenant/user XOR with database checks and owner/provider/chain uniqueness.
- Provider customer records are separate from wallet identities. Scope provider customer identity to the actual Bridge onboarding subject (tenant or user) and retain provider references without storing unnecessary KYC data.
- Implemented persistence decomposition: (1) provider customer mapping with tenant/user owner XOR and unique `(provider, owner)`; (2) one Bridge wallet resource per owner/provider/chain, storing provider wallet ID, address, and status; (3) wallet operation record for funding/transfer/withdrawal/conversion lifecycle with unique idempotency/provider references; (4) currency/network-scoped ledger accounts, transactions, and entries. A user-facing wallet view can aggregate the user's Bridge wallet resources and ledger accounts without making memberships their owner.
- Store provider IDs, normalized onboarding/terms status, timestamps, and minimal audit references only; do not copy KYC documents or raw identity payloads into provider mappings.

Candidate relational constraints (review before creating migrations):

| Record | Candidate key/invariant |
|---|---|
| Wallet owner | Exactly one of `tenant_id` or `user_id` is set (`CHECK num_nonnulls(...) = 1`); partial unique index per owner and wallet purpose |
| Provider customer mapping | Exactly one owner; partial unique indexes on `(provider, tenant_id)` and `(provider, user_id)`; unique `(provider, provider_customer_id)` |
| Provider wallet resource | FK to provider customer; unique `(provider, provider_wallet_id)` and owner/provider/chain; one chain-specific wallet can report multiple asset balances |
| Wallet operation | Owner and tenant scope; operation kind and explicit lifecycle status; unique stable idempotency key; provider reference unique by provider/reference kind when present; source/destination amount and currency stored independently |
| Ledger account | Owner or system account, account purpose, and currency; unique account identity per owner/purpose/currency |
| Ledger transaction and entries | Posted transaction immutable; positive exact decimal entries, currency-scoped debit/credit equality, account currency matches entry currency; reversal references original transaction |

Use PostgreSQL `numeric` values read/written as decimal strings (not JS floating-point) with precision and scale selected for fiat and the confirmed token set. Cursor-paginate operation and ledger history; index owner/tenant and created-time filters used by those lists.

### Proposed accounting model (pending review)

- Maintain a PaqadHR append-only double-entry ledger for custody wallet accounting. Provider balances remain authoritative for custody and reconciliation; internal ledger balances are PaqadHR's accounting view, never user-editable balance fields.
- Represent accounts by owner, accounting purpose, and currency. Keep organisation funds, employee funds, payroll reservations, provider settlement/clearing, and PaqadHR fees distinct.
- Every posted transaction balances per currency. FX is represented as linked currency-specific legs with the quote/rate and provider evidence; never balance USD directly against NGN or silently convert an amount.
- Posted entries are immutable. Corrections and provider reversals use linked reversal transactions. Provider references and operation idempotency keys are unique within a clearly defined provider/operation scope.
- A payroll reservation moves funds between the organisation's available and reserved accounts (or an equivalent explicit hold model). Confirmed payouts consume the reservation; safe failures release it. An ambiguous provider outcome remains reserved until reconciled.
- Keep `PayrollRunFundingLedgerEntry` as a payroll allocation/reconciliation record only if it references the authoritative ledger transaction/reservation and does not independently define wallet available balance. Decide whether to evolve it or replace it after reviewing all callers and production data.
- Preserve rewards wallet accounting as a separate domain and migration. Do not backfill its credits as custodial cash unless product/accounting confirms those funds represent the same legal asset and liability.
- Candidate ledger constraints: posted journal entries balance to zero per currency; posted entries are immutable; every external operation has a stable idempotency key scoped by operation/provider; provider references are unique by provider and reference kind; account currency matches its entries. Enforce balancing in the posting service with transaction/DB protections appropriate to TypeORM/PostgreSQL.

### Compatibility and cutover proposal (not yet approved)

- Add custody-wallet tables and ledger records additively; do not rename or repurpose `tenant_wallets` or `tenant_wallet_transactions`.
- Preserve settled payroll ledger entries and all historical provider references as legacy audit history. Do not synthesize Bridge balances from historic Nomba/Monnify/Noah/Fincra/Bachs values.
- Resolve or explicitly carry each in-flight legacy payroll run with its original provider/reconciliation path. New Bridge ledger activity starts only when Bridge reports a verified funding/transfer event.
- If an existing external balance is deliberately moved into Bridge, record the source withdrawal and Bridge receipt as linked, provider-verified entries; the opening balance must tie to evidence from both sides and must not duplicate the old balance.
- For a new Bridge payroll event, post the financial journal and the run-level allocation/reference in one short DB transaction after provider state is verified. Keep the run ledger as payroll-specific allocation/status evidence, and calculate custody wallet available/reserved funds from the general ledger/holds only.
- Migrate an in-progress payroll run only after reconciliation determines its provider-held amount, active reservations, and unresolved payouts. Do not infer available funds from `PayrollRun.status` or `PayrollItem.status` alone.
- Capture a cutover timestamp/provider scope, reconcile provider and internal balances, then enable new operations. Keep old webhook verification/reconciliation until all old in-flight activity is terminal and the retention policy permits archival.

### Phase 2 work checklist

- [x] Inspect current `Tenant`, `User`, and `TenantMember` ownership relationships.
- [x] Inspect existing rewards wallet and payroll run funding ledger models.
- [x] Record a proposed distinction between custodial wallets, payroll allocation records, and rewards wallet balances.
- [x] Draft a persistence decomposition and candidate ledger constraints (pending product/accounting and Bridge capability review).
- [x] Accept the engineering ownership model: organisation owner is `Tenant`; employee owner is global `User`; employee wallet persists across tenant memberships.
- [x] Implement an initial additive schema for provider customers, chain-specific custody wallets, ledger accounts, journal transactions/entries, and provider operations with idempotency and provider-reference uniqueness.
- [x] Add an internal journal posting service using exact decimal strings and database-enforced per-currency balancing and posted-entry immutability.
- [x] Add Bridge API client scaffolding for customer onboarding links, wallet create/read, virtual accounts, transfers, and transfer status. External write calls require idempotency keys; no automatic retries are issued.
- [x] Add Bridge raw-body webhook signature verification with timestamp bounds, persistent event deduplication, and retryable event claims.
- [x] Add owner-scoped virtual-account funding records and credit the matching organization/member ledger only on final `payment_processed`; record refunds through immutable reversal journals.
- [x] Add tenant-admin organization wallet endpoints and authenticated employee-self wallet endpoints. Employee endpoints use the global `User` identity and do not depend on an active tenant membership.
- [x] Expose organization onboarding/status, wallet creation, and balance routes under tenant payroll authorization; expose employee onboarding/status, wallet creation, and balances under authenticated self-ownership.
- [x] Honor the existing `SkipMember` metadata in global tenant/member guards for employee-self wallet routes, so access to a personal wallet survives leaving every employer.
- [x] Implement Bridge KYC-link lifecycle correctly: persist link ID first, retrieve the Bridge customer ID after hosted onboarding, and require the organization admin's legal business name for business KYC links.
- [x] Require the organization legal name explicitly for hosted business onboarding and use only the authenticated user's verified email; employee onboarding also requires a verified email and employee-provided legal name.
- [ ] Complete accounting review of double-entry, reservation, fee, FX, reversal, and reconciliation rules before production money movement.
- [x] Trace primary callers of `PayrollRunFundingLedgerEntry`: payroll float funding/preflight, payout reservations/retries, payout confirmation/failure reconciliation, and admin/payout ledger reads. Additional direct SQL/reference checks are noted in current model facts.
- [x] Draft additive compatibility and cutover plan; production reconciliation and accounting review remain before approval.
- [ ] Inspect production/staging rewards wallet semantics and payroll ledger records before any migration or balance conversion.
- [x] Finalize the first TypeORM entity/migration design and add ownership, amount, state, idempotency, provider-reference, and lookup constraints/indexes.
- [ ] Verify migration behavior against the deployed schema and review the migration with sanitized production data before rollout.

### Phase 2 design exit criteria

- [x] Owner and wallet asset granularity can represent one employee across multiple employers.
- [x] One authoritative internal accounting source for custody wallet balances is defined: the new journal, reconciled to Bridge.
- [x] Existing rewards balances and payroll run ledgers have explicit compatibility paths.
- [x] Core lifecycle, reversal-link, reservation-account, and idempotency persistence has a first schema design.
- [ ] Phase 2 is not rollout-complete until accounting review, deployed-schema verification, and production-data reconciliation are complete.

## Security and performance requirements for implementation

- Tenant-scope every organisation resource and enforce employee ownership for personal wallets; UUIDs do not grant access.
- Require role authorization and step-up controls where current payment security flows require them; validate request DTOs and reject unknown fields.
- Verify provider webhooks against raw request bodies, deduplicate events, and reconcile provider-confirmed state before crediting or completing payments.
- Use stable idempotency keys for wallet creation, funding, and each payout. Never retry an ambiguous transfer until status is established.
- Keep secrets server-side; do not log tokens, bank credentials, full webhook payloads with PII, or unnecessary provider/customer data.
- Keep database transactions short and free of external I/O. Use exact money representations, selective queries, indexed tenant filters, and paginated transaction lists.
- No balance cache without measured need and explicit freshness/invalidation rules.
