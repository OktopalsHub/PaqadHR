import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
} from "lucide-react";

interface AnalyticsCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: React.ElementType;
}

const AnalyticsCard = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
}: AnalyticsCardProps) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-sm ${trend === "up" ? "text-green-500" : "text-red-500"}`}
            >
              {change}
            </span>
          </div>
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

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
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <AnalyticsCard key={index} {...metric} />
        ))}
      </div>

      {/* Department Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Department Performance Overview
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departmentData.map((dept, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{dept.name}</h4>
                    <Badge
                      variant={dept.performance >= 90 ? "default" : "secondary"}
                    >
                      {dept.performance}% Performance
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{dept.employees} employees</span>
                    <span>${dept.budget.toLocaleString()} budget</span>
                  </div>
                  <Progress value={dept.performance} className="mt-2 h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
