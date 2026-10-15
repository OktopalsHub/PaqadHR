import { Briefcase, Clock, UserCheck, Users } from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import { demoKanbanColumns, demoRecruitmentStats } from '../../../constants/landing-demo-data';

type RecruitmentDemoViewProps = {
  compact?: boolean;
};

const statIcons = [Briefcase, Users, UserCheck, Clock];
const columnColors = [
  'bg-[#f5f9f7] dark:bg-[#112922]',
  'bg-[#f7f4fc] dark:bg-[#211b31]',
  'bg-[#fff8ed] dark:bg-[#302518]',
  'bg-[#eff7fb] dark:bg-[#142a34]',
];

export function RecruitmentDemoView({ compact }: RecruitmentDemoViewProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 bg-[#fbfdfc] p-4 font-montserrat dark:bg-[#0d1e19]',
        compact && 'p-3',
      )}
    >
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
          'grid min-h-0 flex-1 gap-3',
          compact ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {demoKanbanColumns.map((column, index) => (
          <div
            key={column.id}
            className={`flex flex-col rounded-xl border border-[#e2ebe7] p-2.5 dark:border-[#25453a] ${columnColors[index]}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {column.title}
              </p>
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                {column.cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-white bg-white p-2.5 shadow-[0_7px_16px_-14px_rgba(23,60,50,0.6)] transition-transform hover:-translate-y-0.5 dark:border-[#2a4a3f] dark:bg-[#173128]"
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
