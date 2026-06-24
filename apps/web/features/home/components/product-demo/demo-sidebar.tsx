import {
  Briefcase,
  CalendarDays,
  Heart,
  LayoutDashboard,
  Wallet,
} from 'lucide-react';
import type { DemoNavId } from '../../constants/landing-demo-data';
import { demoSidebarItems, demoWorkspace } from '../../constants/landing-demo-data';
import { cn } from '@/lib/utils';

const iconById: Record<DemoNavId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  recruitment: Briefcase,
  payroll: Wallet,
  shoutouts: Heart,
  leaves: CalendarDays,
};

type DemoSidebarProps = {
  activeNav: DemoNavId;
  onNavChange: (nav: DemoNavId) => void;
  navIds: string[];
  compact?: boolean;
};

export function DemoSidebar({ activeNav, onNavChange, navIds, compact }: DemoSidebarProps) {
  return (
    <aside
      className={cn(
        'shrink-0 border-r border-border/60 bg-muted/20 p-3',
        compact ? 'hidden w-44 lg:block' : 'hidden w-48 md:block',
      )}
    >
      <p className="mb-4 truncate px-2 text-xs font-semibold text-foreground">{demoWorkspace.name}</p>
      <nav className="space-y-1" aria-label="Demo navigation">
        {demoSidebarItems.map((item, index) => {
          const Icon = iconById[item.id];
          const isActive = item.id === activeNav;
          const navId = navIds[index];
          return (
            <button
              key={item.id}
              type="button"
              id={navId}
              role="tab"
              aria-selected={isActive}
              aria-controls={`demo-panel-${item.id}`}
              onClick={() => onNavChange(item.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
