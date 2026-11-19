import { PayoutApplyOps } from './payout-apply.ops';
import { PayoutLookupOps } from './payout-lookup.ops';
import { PayoutRetryOps } from './payout-retry.ops';
import { PayoutBranchOps } from './payout-status-branch.ops';
import { PayoutStuckOps } from './payout-stuck.ops';

export function buildPayoutOps(
  factory: never,
  runRepo: never,
  itemRepo: never,
  lifecycleNotify?: never,
  fundingLedger?: never,
  attemptHistory?: never,
) {
  const lookup = new PayoutLookupOps(runRepo, itemRepo);
  const branch = new PayoutBranchOps(factory, lookup, fundingLedger);
  const apply = new PayoutApplyOps(
    factory,
    itemRepo,
    branch,
    lookup,
    lifecycleNotify,
    fundingLedger,
    attemptHistory,
  );
  const stuck = new PayoutStuckOps(factory, runRepo, itemRepo, apply, lookup, lifecycleNotify);
  const retry = new PayoutRetryOps(factory, apply, lookup);
  return { lookup, branch, apply, stuck, retry };
}
