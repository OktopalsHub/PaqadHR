import { Briefcase, CalendarClock, Users, Wallet } from 'lucide-react';
import { ContentCard } from '@/components/content-card';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import { demoDashboardStats } from '../../../constants/landing-demo-data';

type DashboardDemoViewProps = {
  compact?: boolean;
};

const statIcons = [Users, Briefcase, CalendarClock, Wallet];

const recentActivity = [
  { id: 'a1', text: "Liam O'Brien accepted offer — Frontend Engineer", time: '1 hour ago' },
  { id: 'a2', text: 'March payroll approved for 42 employees', time: 'Yesterday' },
  { id: 'a3', text: 'Sarah Chen requested annual leave (5 days)', time: 'Yesterday' },
];

export function DashboardDemoView({ compact }: DashboardDemoViewProps) {
  return (
    <div className={cn('space-y-4 p-4', compact && 'p-3')}>
      <div
        className={cn(
          'grid gap-2',
          compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4',
        )}
      >
        {demoDashboardStats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            icon={statIcons[index] ?? Users}
            className="p-3"
          />
        ))}
      </div>

      <ContentCard title="Recent activity" className="p-0">
        <ul className="divide-y divide-border/60">
          {recentActivity.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <p className="text-xs text-foreground">{item.text}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
            </li>
          ))}
        </ul>
      </ContentCard>
    </div>
  );
}
