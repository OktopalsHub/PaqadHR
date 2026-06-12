import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  Award,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

export function LearningAnalytics() {
  const analyticsData = [
    {
      title: "Learning Completion Rate",
      value: "78%",
      change: "+5%",
      trend: "up",
      icon: Target,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      title: "Average Learning Hours",
      value: "12.5",
      change: "+2.3",
      trend: "up",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "Active Learners",
      value: "142",
      change: "-8",
      trend: "down",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      title: "Courses Completed",
      value: "89",
      change: "+12",
      trend: "up",
      icon: Award,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
  ];

  const departmentProgress = [
    {
      department: "Engineering",
      progress: 85,
      employees: 25,
      completedCourses: 180,
    },
    {
      department: "Marketing",
      progress: 92,
      employees: 12,
      completedCourses: 96,
    },
    { department: "Sales", progress: 78, employees: 18, completedCourses: 134 },
    { department: "HR", progress: 95, employees: 8, completedCourses: 72 },
    {
      department: "Operations",
      progress: 72,
      employees: 15,
      completedCourses: 98,
    },
  ];

  const skillsGapData = [
    { skill: "Digital Marketing", gap: 35, priority: "High" },
    { skill: "Data Analysis", gap: 28, priority: "Medium" },
    { skill: "Project Management", gap: 42, priority: "High" },
    { skill: "Leadership", gap: 15, priority: "Low" },
    { skill: "Communication", gap: 22, priority: "Medium" },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsData.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    {metric.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <Badge
                      variant={
                        metric.trend === "up" ? "default" : "destructive"
                      }
                    >
                      {metric.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {metric.change}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Department Learning Progress
            </CardTitle>
            <CardDescription>
              Learning completion rates by department
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {departmentProgress.map((dept, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{dept.department}</h4>
                      <p className="text-sm text-muted-foreground">
                        {dept.employees} employees • {dept.completedCourses}{" "}
                        courses completed
                      </p>
                    </div>
                    <Badge
                      variant={
                        dept.progress >= 85
                          ? "default"
                          : dept.progress >= 70
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {dept.progress}%
                    </Badge>
                  </div>
                  <Progress value={dept.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skills Gap Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Skills Gap Analysis
            </CardTitle>
            <CardDescription>
              Identified skill gaps across the organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {skillsGapData.map((skill, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{skill.skill}</h4>
                      <p className="text-sm text-muted-foreground">
                        {skill.gap}% gap identified
                      </p>
                    </div>
                    <Badge
                      variant={
                        skill.priority === "High"
                          ? "destructive"
                          : skill.priority === "Medium"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {skill.priority}
                    </Badge>
                  </div>
                  <Progress value={100 - skill.gap} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
