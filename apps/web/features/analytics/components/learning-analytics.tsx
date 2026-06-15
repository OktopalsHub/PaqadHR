import { Award, Clock, Target, Users } from 'lucide-react';
import { ContentCard } from '@/components/content-card';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function LearningAnalytics() {
  const analyticsData = [
    {
      title: 'Learning Completion Rate',
      value: '78%',
      change: '+5%',
      trend: 'up' as const,
      icon: Target,
    },
    {
      title: 'Average Learning Hours',
      value: '12.5',
      change: '+2.3 hrs',
      trend: 'up' as const,
      icon: Clock,
    },
    {
      title: 'Active Learners',
      value: '142',
      change: '-8',
      trend: 'down' as const,
      icon: Users,
    },
    {
      title: 'Courses Completed',
      value: '89',
      change: '+12',
      trend: 'up' as const,
      icon: Award,
    },
  ];

  const departmentProgress = [
    {
      department: 'Engineering',
      progress: 85,
      employees: 25,
      completedCourses: 180,
    },
    {
      department: 'Marketing',
      progress: 92,
      employees: 12,
      completedCourses: 96,
    },
    { department: 'Sales', progress: 78, employees: 18, completedCourses: 134 },
    { department: 'HR', progress: 95, employees: 8, completedCourses: 72 },
    {
      department: 'Operations',
      progress: 72,
      employees: 15,
      completedCourses: 98,
    },
  ];

  const skillsGapData = [
    { skill: 'Digital Marketing', gap: 35, priority: 'High' },
    { skill: 'Data Analysis', gap: 28, priority: 'Medium' },
    { skill: 'Project Management', gap: 42, priority: 'High' },
    { skill: 'Leadership', gap: 15, priority: 'Low' },
    { skill: 'Communication', gap: 22, priority: 'Medium' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analyticsData.map((metric) => (
          <StatCard
            key={metric.title}
            label={metric.title}
            value={metric.value}
            icon={metric.icon}
            trend={{
              value: metric.change,
              positive: metric.trend === 'up',
            }}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ContentCard
          title="Department learning progress"
          description="Learning completion rates by department"
        >
          <div className="space-y-4">
            {departmentProgress.map((dept) => (
              <div key={dept.department} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{dept.department}</h4>
                    <p className="text-sm text-muted-foreground">
                      {dept.employees} employees · {dept.completedCourses} courses completed
                    </p>
                  </div>
                  <Badge
                    variant={
                      dept.progress >= 85
                        ? 'default'
                        : dept.progress >= 70
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {dept.progress}%
                  </Badge>
                </div>
                <Progress value={dept.progress} className="h-2" />
              </div>
            ))}
          </div>
        </ContentCard>

        <ContentCard
          title="Skills gap analysis"
          description="Identified skill gaps across the organization"
        >
          <div className="space-y-4">
            {skillsGapData.map((skill) => (
              <div key={skill.skill} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{skill.skill}</h4>
                    <p className="text-sm text-muted-foreground">{skill.gap}% gap identified</p>
                  </div>
                  <Badge
                    variant={
                      skill.priority === 'High'
                        ? 'destructive'
                        : skill.priority === 'Medium'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {skill.priority}
                  </Badge>
                </div>
                <Progress value={100 - skill.gap} className="h-2" />
              </div>
            ))}
          </div>
        </ContentCard>
      </div>
    </div>
  );
}
