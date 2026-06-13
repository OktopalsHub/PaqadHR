import {
  BarChart2,
  Briefcase,
  Calendar,
  CalendarClock,
  FileText,
  Heart,
  LayoutDashboard,
  Settings,
  Users,
  Building,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Employees", href: "/app/employees", icon: Users },
  { name: "Recruitment", href: "/app/recruitment", icon: Briefcase },
  { name: "Teams", href: "/app/teams", icon: Building },
  { name: "Schedule", href: "/app/schedule", icon: Calendar },
  { name: "Leaves", href: "/app/leaves", icon: CalendarClock },
  { name: "Payroll", href: "/app/payroll", icon: FileText },
  { name: "Shoutouts", href: "/app/shoutouts", icon: Heart },
  { name: "Analytics", href: "/app/analytics", icon: BarChart2 },
  { name: "Settings", href: "/app/settings", icon: Settings },
];
