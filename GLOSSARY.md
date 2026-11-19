# PaqadHR Payments and Payroll

This context covers payroll money movement, custodial wallets, subscription billing, and rewards spending.

## Language

**Organisation**:
A PaqadHR tenant/workspace that employs members and owns organisation-level payroll funds.
_Avoid_: Employer account when referring to the PaqadHR `Tenant` identity.

**Employee**:
A person represented by a PaqadHR user who may have membership relationships with one or more organisations.
_Avoid_: Tenant member when referring to the person rather than their organisation relationship.

**Membership**:
The relationship between a user and one organisation, including that user's role and employment context there.
_Avoid_: Employee wallet owner.

**Custodial wallet**:
A wallet relationship for funds held and moved through a payment provider, owned in PaqadHR by one organisation or one employee.
_Avoid_: Rewards wallet.

**Rewards wallet**:
An organisation's PaqadHR balance used for rewards spending. It is separate from funds held in a custodial payroll wallet.
_Avoid_: Payroll wallet.

**Payroll funding ledger**:
The records that track funding allocated to a payroll run, reservations, confirmed payouts, and releases.
_Avoid_: Custodial wallet balance.

**Payroll funding attempt**:
A provider checkout or funding action associated with one payroll run, including its provider reference and outcome. A retry-shortfall checkout is its own attempt; the record does not itself allocate funds to the run.
_Avoid_: Payroll funding ledger entry.

**Payroll payout attempt**:
One submission to pay one payroll item through a provider. A retry creates a new attempt, while Bridge wallet operations record the individual custody-transfer legs for a Bridge attempt.
_Avoid_: Payroll item status.

**Employee Bridge bank destination**:
A verified bank payment method linked as an external account under the employee's own Bridge customer. For fiat salary, the organisation first transfers payroll funds to the employee's Bridge wallet; the employee-owned wallet then sends the fixed fiat amount to this destination.
_Avoid_: Organisation-owned bank payout account for employee salary.
