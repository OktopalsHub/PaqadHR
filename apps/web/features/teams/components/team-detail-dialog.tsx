import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Target,
  Calendar,
  DollarSign,
  TrendingUp,
  MessageSquare,
  FileText,
} from "lucide-react";

interface TeamDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: string;
    name: string;
    department: string;
    lead: {
      name: string;
      avatar?: string;
      initials: string;
    };
    members: number;
    performance: number;
    projects: number;
    budget: number;
  } | null;
}

export function TeamDetailDialog({
  open,
  onOpenChange,
  team,
}: TeamDetailDialogProps) {
  if (!team) return null;

  const teamMembers = [
    {
      name: "Alice Johnson",
      role: "Senior Developer",
      avatar: "",
      initials: "AJ",
      performance: 95,
    },
    {
      name: "Bob Smith",
      role: "Developer",
      avatar: "",
      initials: "BS",
      performance: 88,
    },
    {
      name: "Carol Davis",
      role: "UI/UX Designer",
      avatar: "",
      initials: "CD",
      performance: 92,
    },
    {
      name: "David Wilson",
      role: "Developer",
      avatar: "",
      initials: "DW",
      performance: 87,
    },
  ];

  const projects = [
    {
      name: "E-commerce Platform",
      status: "In Progress",
      progress: 75,
      deadline: "2024-04-15",
    },
    {
      name: "Mobile App Redesign",
      status: "Planning",
      progress: 25,
      deadline: "2024-05-01",
    },
    {
      name: "API Integration",
      status: "Completed",
      progress: 100,
      deadline: "2024-03-20",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{team.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{team.department}</Badge>
                <span className="text-sm text-muted-foreground">
                  Led by {team.lead.name}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{team.members}</p>
                  <p className="text-sm text-muted-foreground">Members</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">{team.projects}</p>
                  <p className="text-sm text-muted-foreground">Projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold">{team.performance}%</p>
                  <p className="text-sm text-muted-foreground">Performance</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold">${team.budget / 1000}K</p>
                  <p className="text-sm text-muted-foreground">Budget</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={team.performance} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  Current performance: {team.performance}% (Above average)
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="grid gap-4">
              {teamMembers.map((member, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{member.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.role}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {member.performance}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Performance
                        </p>
                      </div>
                    </div>
                    <Progress value={member.performance} className="mt-3 h-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <div className="grid gap-4">
              {projects.map((project, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Deadline: {project.deadline}
                        </p>
                      </div>
                      <Badge
                        variant={
                          project.status === "Completed"
                            ? "default"
                            : project.status === "In Progress"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Productivity Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">This Month</span>
                      <span className="text-sm font-medium">+12%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Last Month</span>
                      <span className="text-sm font-medium">+8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Quarter</span>
                      <span className="text-sm font-medium">+15%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Key Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Avg. Task Completion</span>
                      <span className="text-sm font-medium">4.2 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Code Quality Score</span>
                      <span className="text-sm font-medium">94/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Client Satisfaction</span>
                      <span className="text-sm font-medium">4.8/5</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
