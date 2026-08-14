import { Check, Loader2, Phone, ShoppingBag, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RewardRedemption } from '@/lib/api/rewards';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { cn } from '@/lib/utils';

export function ClaimRow({ claim }: { claim: RewardRedemption }) {
  const statusColors: Record<string, string> = {
    SUCCESS: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
    PENDING: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    FAILED: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3 bg-card shadow-sm">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {claim.rewardType === 'NOMBA_AIRTIME' || claim.rewardType === 'RELOADLY_AIRTIME' ? (
          <Phone className="size-4" />
        ) : claim.rewardType === 'NOMBA_UTILITY' || claim.rewardType === 'RELOADLY_UTILITY' ? (
          <Zap className="size-4 text-indigo-600" />
        ) : claim.rewardType === 'CUSTOM' ? (
          <Sparkles className="size-4" />
        ) : (
          <ShoppingBag className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{claim.rewardName ?? claim.rewardId}</p>
        <p className="text-[11px] text-muted-foreground">
          {claim.pointsSpent} {PAQ_POINTS_NAME} ·{' '}
          <span suppressHydrationWarning>{new Date(claim.createdAt).toLocaleDateString()}</span>
        </p>
        {claim.voucherCode ? (
          claim.voucherCode.startsWith('http') ? (
            <a
              href={claim.voucherCode}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs font-semibold text-primary underline underline-offset-2 inline-block"
            >
              Redeem gift card
            </a>
          ) : (
            <p className="mt-1 font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded inline-block">
              Code: {claim.voucherCode}
              {claim.voucherPin ? ` · PIN: ${claim.voucherPin}` : ''}
            </p>
          )
        ) : null}
        {claim.voucherInstructions ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground italic">
            {claim.voucherInstructions}
          </p>
        ) : null}
        {claim.status === 'FAILED' && claim.errorMessage && (
          <p className="mt-1 text-[11px] text-red-500 font-semibold leading-tight">
            Error: {claim.errorMessage}
          </p>
        )}
      </div>
      <Badge
        variant="outline"
        className={cn(
          'shrink-0 text-[10px] font-bold flex items-center gap-1.5',
          statusColors[claim.status],
        )}
      >
        {claim.status === 'SUCCESS' ? <Check className="size-2.5" /> : null}
        {claim.status === 'PENDING' ? <Loader2 className="size-2.5 animate-spin" /> : null}
        {claim.status}
      </Badge>
    </div>
  );
}
