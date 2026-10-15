import { Briefcase, CalendarClock, ChevronRight, Sparkles, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { demoDashboardStats } from '../../../constants/landing-demo-data';

type DashboardDemoViewProps = {
  compact?: boolean;
};

const statIcons = [Users, Briefcase, CalendarClock, Wallet];
const statAccents = [
  'bg-[#e7f7ef] text-[#237457]',
  'bg-[#eee9fb] text-[#6c52a0]',
  'bg-[#fff3db] text-[#a46b18]',
  'bg-[#e7f3fb] text-[#2c6e8b]',
];

const recentActivity = [
  { id: 'a1', text: "Liam O'Brien accepted offer — Frontend Engineer", time: '1 hour ago' },
  { id: 'a2', text: 'March payroll approved for 42 employees', time: 'Yesterday' },
  { id: 'a3', text: 'Sarah Chen requested annual leave (5 days)', time: 'Yesterday' },
];

export function DashboardDemoView({ compact }: DashboardDemoViewProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col gap-3 bg-[#fbfdfc] p-4 font-montserrat dark:bg-[#0d1e19]',
        compact && 'p-3',
      )}
    >
      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {demoDashboardStats.map((stat, index) => (
          <article
            key={stat.label}
            className="rounded-xl border border-[#e2ebe7] bg-white p-3 shadow-[0_8px_20px_-18px_rgba(23,60,50,0.5)] dark:border-[#25453a] dark:bg-[#132720]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {stat.label}
              </p>
              <span
                className={`flex size-6 items-center justify-center rounded-lg ${statAccents[index]}`}
              >
                {(() => {
                  const Icon = statIcons[index] ?? Users;
                  return <Icon className="size-3.5" />;
                })()}
              </span>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-foreground">
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{stat.hint}</p>
          </article>
        ))}
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e2ebe7] bg-white shadow-[0_8px_20px_-18px_rgba(23,60,50,0.5)] dark:border-[#25453a] dark:bg-[#132720]">
        <div className="flex items-center justify-between border-b border-[#edf1ef] px-3.5 py-3 dark:border-[#25453a]">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-[#e7f7ef] text-primary">
              <Sparkles className="size-3" />
            </span>
            <p className="text-xs font-semibold text-foreground">Recent activity</p>
          </div>
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </div>
        <ul className="divide-y divide-[#edf1ef] dark:divide-[#25453a]">
          {recentActivity.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
              <p className="flex-1 text-xs text-foreground">{item.text}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
