import { StatCard } from "@/components/stat-card";
import { ContentCard } from "@/components/content-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, Calendar, Target } from "lucide-react";

export function CompanyAnalytics() {
  const metrics = [
    {
      title: "Total Employees",
      value: "284",
      change: "+12.5%",
      trend: "up" as const,
      icon: Users,
    },
    {
      title: "Monthly Payroll",
      value: "$1.2M",
      change: "+8.2%",
      trend: "up" as const,
      icon: DollarSign,
    },
    {
      title: "Avg. Attendance",
      value: "94.8%",
      change: "-2.1%",
      trend: "down" as const,
      icon: Calendar,
    },
    {
      title: "Performance Score",
      value: "87.3",
      change: "+5.7%",
      trend: "up" as const,
      icon: Target,
    },
  ];

  const departmentData = [
    { name: "Engineering", employees: 85, budget: 425000, performance: 92 },
    { name: "Sales", employees: 42, budget: 210000, performance: 88 },
    { name: "Marketing", employees: 28, budget: 140000, performance: 85 },
    { name: "HR", employees: 15, budget: 75000, performance: 91 },
    { name: "Operations", employees: 35, budget: 175000, performance: 87 },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <StatCard
            key={metric.title}
            label={metric.title}
            value={metric.value}
            icon={metric.icon}
            trend={{
              value: metric.change,
              positive: metric.trend === "up",
            }}
          />
        ))}
      </div>

      <ContentCard
        title="Department performance overview"
        description="Sample analytics preview. Connect live data in a future release."
      >
        <div className="space-y-4">
          {departmentData.map((dept) => (
            <div
              key={dept.name}
              className="rounded-xl border border-border/60 bg-muted/20 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium">{dept.name}</h4>
                <Badge variant={dept.performance >= 90 ? "default" : "secondary"}>
                  {dept.performance}% performance
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{dept.employees} employees</span>
                <span>${dept.budget.toLocaleString()} budget</span>
              </div>
              <Progress value={dept.performance} className="mt-2 h-2" />
            </div>
          ))}
        </div>
      </ContentCard>
    </div>
  );
}
