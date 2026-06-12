"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Users,
  Calendar,
  Clock,
  FileText,
  BarChart2,
  LayoutDashboard,
  UserPlus,
  Briefcase,
  Settings,
  Package,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Heart,
  Building,
  Sparkles,
} from "lucide-react";
import { NavMain } from "./nav-main";

export const AppSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const navItems = [
    {
      name: "Dashboard",
      href: "/app",
      icon: LayoutDashboard,
      gradient: "from-modern-purple-500 to-modern-blue-500",
    },
    {
      name: "Employees",
      href: "/app/employees",
      icon: Users,
      gradient: "from-modern-blue-500 to-modern-emerald-500",
    },
    {
      name: "Teams",
      href: "/app/teams",
      icon: Building,
      gradient: "from-modern-emerald-500 to-modern-blue-500",
    },
    {
      name: "Calendar",
      href: "/app/calendar",
      icon: Calendar,
      gradient: "from-modern-emerald-500 to-modern-blue-500",
    },
    {
      name: "Leaves",
      href: "/app/leaves",
      icon: Calendar,
      gradient: "from-modern-purple-500 to-modern-rose-500",
    },
    {
      name: "Attendance",
      href: "/app/attendance",
      icon: Clock,
      gradient: "from-modern-blue-500 to-modern-purple-500",
    },
    {
      name: "Payroll",
      href: "/app/payroll",
      icon: FileText,
      gradient: "from-modern-emerald-500 to-modern-blue-500",
    },
    {
      name: "Reviews",
      href: "/app/reviews",
      icon: BarChart2,
      gradient: "from-modern-rose-500 to-modern-purple-500",
    },
    {
      name: "Assets",
      href: "/app/assets",
      icon: Package,
      gradient: "from-modern-blue-500 to-modern-emerald-500",
    },
    {
      name: "Onboarding",
      href: "/app/onboarding",
      icon: UserPlus,
      gradient: "from-modern-blue-500 to-modern-emerald-500",
    },
    {
      name: "Recruitment",
      href: "/app/recruitment",
      icon: Briefcase,
      gradient: "from-modern-purple-500 to-modern-blue-500",
    },
    {
      name: "Learning",
      href: "/app/learning",
      icon: BookOpen,
      gradient: "from-modern-emerald-500 to-modern-blue-500",
    },
    {
      name: "Shoutouts",
      href: "/app/shoutouts",
      icon: Heart,
      gradient: "from-modern-rose-500 to-modern-purple-500",
    },
    {
      name: "Grievances",
      href: "/app/grievance",
      icon: AlertTriangle,
      gradient: "from-modern-rose-500 to-modern-purple-500",
    },
    {
      name: "Promotions",
      href: "/app/promotions",
      icon: TrendingUp,
      gradient: "from-modern-purple-500 to-modern-emerald-500",
    },
    {
      name: "Settings",
      href: "/app/settings",
      icon: Settings,
      gradient: "from-modern-emerald-500 to-modern-purple-500",
    },
  ];

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="bg-sidebar/95 backdrop-blur-xl"
    >
      <SidebarHeader className="relative">
        <SidebarMenu>
          <SidebarMenuItem className="relative">
            <SidebarMenuButton asChild className="text-xs">
              <div>
                <Sparkles />
                <span>Modern HRMS</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarTrigger className="size-6 absolute top-1/2 right-[-50px] z-[500] -translate-y-1/2 " />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>{/* <GeneralSettings /> */}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
