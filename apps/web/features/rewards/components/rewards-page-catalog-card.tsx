import { Gift, Loader2, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CatalogItem } from '@/lib/api/rewards';
import { PAQ_POINTS_NAME } from '@/lib/constants/paq-points';
import { cn } from '@/lib/utils';
import { formatCost } from './rewards-page-catalog-utils';

export function CatalogCard({
  item,
  onClaim,
  isClaiming,
  isAdmin = false,
  onDelete,
  isDeleting = false,
  onAddDefault,
  isAddingDefault = false,
}: {
  item: CatalogItem;
  onClaim: (item: CatalogItem) => void;
  isClaiming: boolean;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  onAddDefault?: (item: CatalogItem) => void;
  isAddingDefault?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const isTemplate = item.id.startsWith('default_');
  const showImage = Boolean(item.imageUrl) && !imageFailed;
  const typeColors: Record<string, string> = {
    TREMENDOUS: 'bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800',
    NOMBA_AIRTIME: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    MONNIFY_AIRTIME:
      'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    NOMBA_UTILITY: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
    MONNIFY_UTILITY: 'bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-800',
    CUSTOM: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
  };

  const typeLabels: Record<string, string> = {
    TREMENDOUS: 'Digital Voucher',
    NOMBA_AIRTIME: 'Airtime',
    MONNIFY_AIRTIME: 'Airtime',
    NOMBA_UTILITY: 'Utility',
    MONNIFY_UTILITY: 'Utility',
    CUSTOM: isTemplate ? 'Template Perk' : 'Custom Perk',
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      {showImage ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-muted/30 relative">
          <Image
            src={item.imageUrl!}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain p-4 transition-transform group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
          {isTemplate && (
            <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600 text-white border-none text-[9px] uppercase tracking-wider font-bold">
              Template
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15 relative">
          <Gift className="size-10 text-primary/40" />
          {isTemplate && (
            <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600 text-white border-none text-[9px] uppercase tracking-wider font-bold">
              Template
            </Badge>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
            {item.name}
          </h3>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', typeColors[item.type])}>
            {typeLabels[item.type]}
          </Badge>
        </div>
        {item.description ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        ) : null}
        {item.countryCode ? (
          <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
            <span>🌐</span> {item.countryCode}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">
              {item.pointsCost.toLocaleString()}
              {isAdmin && item.type === 'TREMENDOUS' && item.adminPricing ? (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  (
                  {formatCost(
                    item.adminPricing.reloadlyCost,
                    item.adminPricing.reloadlyCostCurrency,
                  )}
                  )
                </span>
              ) : null}
            </p>
            <p className="text-[10px] text-muted-foreground">{PAQ_POINTS_NAME}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && item.type === 'CUSTOM' && onDelete && !isTemplate && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                disabled={isDeleting}
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}

            {isTemplate ? (
              isAdmin && onAddDefault ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 border-amber-300 bg-amber-500/5 text-amber-700 hover:bg-amber-500 hover:text-white"
                  disabled={isAddingDefault}
                  onClick={() => onAddDefault(item)}
                >
                  {isAddingDefault ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Plus className="size-3" />
                  )}
                  Add to Catalog
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled>
                  HR Template
                </Button>
              )
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs font-bold"
                disabled={isClaiming}
                onClick={() => onClaim(item)}
              >
                {isClaiming ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Redeem
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
