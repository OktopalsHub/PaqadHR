import { Bell, Search } from 'lucide-react';
import type { DemoNavId } from '../../constants/landing-demo-data';
import { demoSidebarItems, demoWorkspace } from '../../constants/landing-demo-data';

const titleByNav: Record<DemoNavId, string> = Object.fromEntries(
  demoSidebarItems.map((item) => [item.id, item.label]),
) as Record<DemoNavId, string>;

type DemoTopbarProps = {
  activeNav: DemoNavId;
};

export function DemoTopbar({ activeNav }: DemoTopbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{titleByNav[activeNav]}</p>
        <p className="truncate text-[11px] text-muted-foreground">{demoWorkspace.name} workspace</p>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Search className="size-4" aria-hidden />
        <Bell className="size-4" aria-hidden />
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold text-foreground">
          SC
        </span>
      </div>
    </div>
  );
}
