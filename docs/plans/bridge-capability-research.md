# Bridge Capability Research for PaqadHR

**Reviewed:** 2026-11-07  
**Sources:** Bridge's first-party developer documentation and supported-country pages.  
**Purpose:** Validate the proposed Bridge payroll and custodial-wallet architecture. Public documentation does not confirm PaqadHR's commercial account entitlements or production underwriting decision.

**Nigeria update (2026-11-07):** Bridge's supported-country table lists Nigeria as a High Risk onboarding geography; the user confirmed PaqadHR intends to serve Nigerian organizations/employees and cites Helicode as a peer. This supports proceeding with Nigeria in the product design, subject to Bridge's required due diligence and PaqadHR account approval. The public evidence reviewed did not independently verify Helicode's provider, and Nigeria onboarding eligibility does not establish NGN fiat-rail support.

## Findings supported by Bridge's documentation

### Payroll flow is a documented use case

Bridge publishes a payroll integration guide that describes: onboarding employer and employee customers, creating a Bridge wallet for each, giving the employer USD or EUR virtual account instructions, converting deposits into stablecoins held in the employer wallet, and transferring from the employer wallet to each employee wallet. The guide explicitly performs one Transfers API request per employee and uses an `Idempotency-Key`. [Payroll guide](https://apidocs.bridge.xyz/get-started/guides/common-use-cases/payroll)

This demonstrates product/API fit for the proposed flow, but does not establish that PaqadHR is enabled for every route in the guide.

### Customer onboarding and wallet ownership

Bridge distinguishes **individual** customers from **business** customers. It supports hosted onboarding links or direct customer API submission. Customers must satisfy KYC/KYB, terms, and any rail-specific endorsement requirements before transacting. [Onboard a customer](https://apidocs.bridge.xyz/get-started/introduction/quick-start/create-your-first-customer)

Hosted KYC links accept `full_name`, `email`, and `type`; for a business, `full_name` must be the legal business name. Link creation returns the KYC and terms links, while the `customer_id` is available from the KYC-link status after the hosted flow. PaqadHR must persist the KYC-link ID first and attach the provider customer ID after status refresh. [KYC links for new customers](https://apidocs.bridge.xyz/platform/customers/customers/kyclinks)

Bridge describes custodial wallets for an individual user or company treasury. Wallet creation requires an onboarded customer and any required KYC/KYB or endorsements; the API returns a wallet ID, chain, and address. [Custodial wallets](https://apidocs.bridge.xyz/get-started/guides/wallets/overview), [Move money to and from wallets](https://apidocs.bridge.xyz/platform/wallets/move-money)

Wallet balances include an array of assets/currencies for a chain-specific wallet. This suggests PaqadHR should store provider wallet identity at least by Bridge customer and wallet ID/chain, while modeling asset balances separately; do not assume one provider wallet per currency. The actual Bridge asset and chain combinations must be confirmed in the account's enabled route explorer. [Wallet balance and history APIs](https://apidocs.bridge.xyz/platform/wallets/move-money)

### Nigeria and geographic eligibility

Bridge's current country table classifies Nigeria as **High Risk** and marks the listed columns for USD ACH/FedWire, EUR SEPA, GBP FPS, crypto-to-crypto, and custodial wallets as available. Bridge says High Risk jurisdictions require additional due diligence and controls. Crucially, Bridge states that this table describes where customers can be onboarded, **not** where transactions are supported; transaction eligibility must be checked against rail-specific documentation. [Supported Countries List](https://apidocs.bridge.xyz/platform/customers/compliance/supported-countries-list)

The public supported fiat-rail list names USD ACH/FedNow/Wire, EUR SEPA, GBP Faster Payments, plus selected MXN/BRL/COP rails. It does **not** list NGN. Therefore public docs do not substantiate NGN funding or payout. Nigeria's country eligibility must not be read as NGN rail support. [Supported blockchains and fiat rails](https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes)

### Fiat and stablecoin routes

The public guide supports USD and EUR employer virtual accounts in the example flow. Its current route page lists USD ACH/FedNow/Wire, EUR SEPA, and GBP Faster Payments; availability is subject to route and account approval. [Payroll guide](https://apidocs.bridge.xyz/get-started/guides/common-use-cases/payroll), [Supported blockchains and fiat rails](https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes)

Bridge supports custodial stablecoin wallets, crypto-to-crypto transfers, fiat funding into wallets, and off-ramping via its orchestration APIs. All wallet movements should use the API; Bridge warns against sending directly from the wallet address. [Custodial wallets](https://apidocs.bridge.xyz/get-started/guides/wallets/overview), [Move money to and from wallets](https://apidocs.bridge.xyz/platform/wallets/move-money), [Send wallet funds to a crypto address](https://apidocs.bridge.xyz/get-started/guides/wallets/crypto-to-crypto)

The public pages reviewed here do not provide a stable, readable matrix of the exact **USDC/USDT × network × direction × Nigeria** combinations proposed for PaqadHR. The route page warns that unsupported asset/network deposits can be irretrievable and that EEA users have extra stablecoin restrictions. Require Bridge to confirm the exact pairs enabled for PaqadHR in writing before locking wallet asset/network constraints or advertising them. [Supported blockchains and fiat rails](https://apidocs.bridge.xyz/get-started/introduction/what-we-support/payment-routes)

### Employer to employee transfers and prefunding nuance

Bridge's payroll guide says to transfer from the employer wallet to each employee wallet with one transfer call per employee. The prefunded-wallet documentation also says a normal Bridge wallet can be the source only when `on_behalf_of` is the same customer that owns it; a special prefunded wallet is the exception and may fund transfers for multiple customers. That distinction should be confirmed against the payroll guide's transfer example and the PaqadHR contract design. Do not assume that a shared platform wallet can be used interchangeably with one employer-owned wallet. [Payroll guide](https://apidocs.bridge.xyz/get-started/guides/common-use-cases/payroll), [Prefunded wallets](https://apidocs.bridge.xyz/platform/wallets/prefunded_wallets)

Bridge transfer states include review, funds received, processing, error, cancelled, returned, and refund states in its event examples. A transfer should not be considered final based only on the initial create response. [Webhook event structure](https://apidocs.bridge.xyz/platform/additional-information/webhooks/structure)

### Webhooks and idempotency

Bridge documents signed webhooks, event IDs, retries, and transfer, wallet-activity, customer, and virtual-account event categories. Webhook verification uses the raw request body and Bridge's per-endpoint public-key signature scheme; the reviewed docs say to return HTTP 200 quickly and describe automatic retry for up to two days. Deduplicate by Bridge's globally unique event ID, and handle state transitions/out-of-order delivery. [Webhook signature verification](https://apidocs.bridge.xyz/platform/additional-information/webhooks/signature), [Webhook overview](https://apidocs.bridge.xyz/platform/additional-information/webhooks/overview), [Webhook event structure](https://apidocs.bridge.xyz/platform/additional-information/webhooks/structure)

Bridge's payroll and wallet examples use an `Idempotency-Key` for customer, wallet, virtual account, and transfer creation. Use stable operation-specific keys in PaqadHR. [Payroll guide](https://apidocs.bridge.xyz/get-started/guides/common-use-cases/payroll), [Move money to and from wallets](https://apidocs.bridge.xyz/platform/wallets/move-money)

## Capability matrix

| Capability | Public-doc evidence | Phase 0 status |
|---|---|---|
| Employer business customer and employee individual customer | Bridge supports business and individual customer types with KYC/KYB, terms, and endorsements; Nigeria appears in the High Risk onboarding list | Nigeria is a reasonable target market; PaqadHR onboarding eligibility/requirements and account approval still need Bridge confirmation |
| Custodial wallets for company and people | Documented, subject to onboarding and required approvals | Public capability confirmed; account entitlement and owner-specific requirements open |
| USD employer funding | USD virtual account payroll example; USD ACH/FedNow/Wire listed | Public route support; availability, account approval, limits, fees, settlement and exact funding instructions open |
| EUR employer funding | EUR virtual account payroll example; SEPA listed | Public route support; account approval, limits, fees and settlement open |
| GBP funding/payout | GBP Faster Payments listed | Public rail support, but payroll-guide virtual-account example covers USD/EUR only; exact wallet use and account enablement open |
| NGN | Not listed in public fiat rails | No public evidence of NGN rail; must confirm separately, otherwise use Nomba only for its agreed Nigerian rewards-purchase scope and do not assume payroll NGN support |
| USDC/USDT networks | Generic supported asset/chain route explorer exists, but exact required matrix was not extractable from public page | Open; obtain precise allowlist from Bridge |
| Employer → employee wallet payout | Official payroll flow; one API transfer per employee | Public flow confirmed; account rules/limits/finality open |
| Bank withdrawal | Wallet movement/orchestration documentation supports routes to external accounts | Exact eligible currencies/countries and customer endorsements open |
| Webhook security/retries | Raw-body signature validation, event IDs, retries documented | Public implementation requirements confirmed; verify exact enabled event types and sandbox behavior in PaqadHR account |

## Questions to send Bridge / resolve in the dashboard

1. Is PaqadHR (a Nigerian HR/payroll company) eligible for production business onboarding and the Bridge Wallets/Orchestration APIs? Which contracting entity and program apply?
2. Can PaqadHR onboard Nigerian business customers and Nigerian individual employees? What KYC/KYB documents, terms, endorsements, limits, and restrictions apply to both?
3. Does Nigeria support any NGN pay-in or payout route? If no, what exact USD/EUR/GBP/crypto routes are available to Nigeria-resident business and individual customers?
4. For PaqadHR's production account, provide exact supported asset × blockchain pairs for USDC and USDT, including inbound deposits, wallet-to-wallet transfers, and withdrawals, for Nigeria and each employee country.
5. Can an employer-owned wallet transfer to employee-owned Bridge wallets with the employer as `on_behalf_of`? Is a provider customer relationship required between employer and employee? What does the payroll guide's sample represent?
6. Is one customer allowed multiple wallets/chains and multiple assets per wallet? What are wallet immutability, closure, recovery, and employee account lifecycle rules?
7. What are per-currency funding/payout minimums, fees, FX spreads, limits, settlement windows, and reversal/return behavior?
8. What exact terminal transfer states and webhook event types should PaqadHR use? What are sandbox and live webhook retry/idempotency guarantees?
9. Can PaqadHR use a provider-side developer fee or other supported fee collection mechanism, and what permissions/contract terms are required?

## Bottom line for the architecture

Bridge's official public documentation describes almost exactly the employer-wallet / employee-wallet payroll pattern in the proposal, including virtual-account funding and per-employee transfers. However, current public docs do not establish PaqadHR's eligibility, the specific USDC/USDT networks, or NGN rails. The model should remain asset/rail-capability-driven and the production route matrix should remain a Phase 0 blocker until Bridge confirms those account-specific facts.
