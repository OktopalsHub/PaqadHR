import {
  BarChart2,
  Briefcase,
  Calendar,
  CalendarClock,
  Clock,
  FileText,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Settings,
  Users,
} from 'lucide-react';
import { tenantPath, tenantRoot } from '@/lib/navigation/tenant-routes';

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  segment?: string;
};

export const navItemDefs: Omit<NavItem, 'href'>[] = [
  { name: 'Dashboard', segment: '', icon: LayoutDashboard },
  { name: 'Employees', segment: 'employees', icon: Users },
  { name: 'Recruitment', segment: 'recruitment', icon: Briefcase },
  { name: 'Schedule', segment: 'schedule', icon: Calendar },
  { name: 'Attendance', segment: 'attendance', icon: Clock },
  { name: 'Leaves', segment: 'leaves', icon: CalendarClock },
  { name: 'Payroll', segment: 'payroll', icon: FileText },
  { name: 'Shoutouts', segment: 'shoutouts', icon: Heart },
  { name: 'Analytics', segment: 'analytics', icon: BarChart2 },
  { name: 'Logs', segment: 'activity', icon: ScrollText },
  { name: 'Settings', segment: 'settings', icon: Settings },
];

export function getNavItems(slug: string): NavItem[] {
  return navItemDefs.map((item) => ({
    ...item,
    href: item.segment ? tenantPath(slug, item.segment) : tenantRoot(slug),
  }));
}

export const navItems: NavItem[] = navItemDefs.map((item) => ({
  ...item,
  href: item.segment ? `/app/${item.segment}` : '/app',
}));
