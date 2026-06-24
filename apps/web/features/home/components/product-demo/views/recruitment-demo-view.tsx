import { Briefcase, Clock, UserCheck, Users } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import {
  demoKanbanColumns,
  demoRecruitmentStats,
} from '../../../constants/landing-demo-data';

type RecruitmentDemoViewProps = {
  compact?: boolean;
};

const statIcons = [Briefcase, Users, UserCheck, Clock];

export function RecruitmentDemoView({ compact }: RecruitmentDemoViewProps) {
  return (
    <div className={cn('space-y-4 p-4', compact && 'p-3')}>
      {!compact ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {demoRecruitmentStats.map((stat, index) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              icon={statIcons[index] ?? Briefcase}
              className="p-3"
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-3',
          compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {demoKanbanColumns.map((column) => (
          <div
            key={column.id}
            className="rounded-xl border border-border/50 bg-muted/20 p-2.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {column.title}
              </p>
              <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {column.cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-border/60 bg-card p-2.5 transition-transform hover:-translate-y-0.5"
                >
                  <p className="text-xs font-medium text-foreground">{card.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{card.role}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
