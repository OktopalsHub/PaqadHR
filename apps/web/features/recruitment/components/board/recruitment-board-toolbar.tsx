import { Filter, Search, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type RecruitmentBoardToolbarProps = {
  title?: string;
  titleAction?: ReactNode;
  description?: string;
  qualifiedCount: number;
  disqualifiedCount: number;
  search?: string;
  onSearchChange?: (value: string) => void;
  showActions?: boolean;
  viewToggle?: ReactNode;
  className?: string;
};

export function RecruitmentBoardToolbar({
  title,
  titleAction,
  description,
  qualifiedCount,
  disqualifiedCount,
  search,
  onSearchChange,
  showActions = true,
  viewToggle,
  className,
}: RecruitmentBoardToolbarProps) {
  return (
    <div className={cn('space-y-3 border-b border-border/60 pb-4', className)}>
      {title || titleAction ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {title ? <h3 className="text-sm font-semibold tracking-tight">{title}</h3> : <span />}
          {titleAction}
        </div>
      ) : null}

      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-md text-[11px]">
            Qualified {qualifiedCount}
          </Badge>
          <Badge variant="outline" className="rounded-md text-[11px]">
            Disqualified {disqualifiedCount}
          </Badge>
        </div>

        {showActions ? (
          <div className="flex flex-wrap items-center gap-2">
            {viewToggle}
            <div className="relative w-full sm:w-52">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search candidates…"
                className="h-8 rounded-lg pl-8 text-xs"
                value={search ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                readOnly={!onSearchChange}
              />
            </div>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <Filter className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="size-8 shrink-0" disabled>
              <Settings2 className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
