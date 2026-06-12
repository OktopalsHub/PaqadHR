import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserPlus,
  Settings,
  MoreHorizontal,
  TrendingUp,
  Calendar,
  Target,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TeamDetailDialog } from "@/features/teams/components/team-detail-dialog";

interface Team {
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
}

export function TeamManagement() {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetail, setShowTeamDetail] = useState(false);

  const teams: Team[] = [
    {
      id: "1",
      name: "Frontend Development",
      department: "Engineering",
      lead: { name: "Sarah Chen", initials: "SC" },
      members: 8,
      performance: 94,
      projects: 3,
      budget: 240000,
    },
    {
      id: "2",
      name: "Backend Infrastructure",
      department: "Engineering",
      lead: { name: "Mike Johnson", initials: "MJ" },
      members: 6,
      performance: 91,
      projects: 2,
      budget: 180000,
    },
    {
      id: "3",
      name: "Digital Marketing",
      department: "Marketing",
      lead: { name: "Lisa Wang", initials: "LW" },
      members: 5,
      performance: 87,
      projects: 4,
      budget: 120000,
    },
    {
      id: "4",
      name: "Sales Operations",
      department: "Sales",
      lead: { name: "Tom Brown", initials: "TB" },
      members: 7,
      performance: 89,
      projects: 5,
      budget: 200000,
    },
  ];

  const handleViewTeam = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamDetail(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage teams and departments</p>
        </div>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card
            key={team.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{team.department}</Badge>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Team Lead */}
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={team.lead.avatar} />
                  <AvatarFallback className="text-xs">
                    {team.lead.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{team.lead.name}</p>
                  <p className="text-xs text-muted-foreground">Team Lead</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{team.members} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span>{team.projects} projects</span>
                </div>
              </div>

              {/* Performance */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Performance
                  </span>
                  <span className="text-sm font-medium">
                    {team.performance}%
                  </span>
                </div>
                <Progress value={team.performance} className="h-2" />
              </div>

              {/* Budget */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Budget</span>
                <span className="text-sm font-medium">
                  ${team.budget.toLocaleString()}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewTeam(team)}
                >
                  View Details
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TeamDetailDialog
        open={showTeamDetail}
        onOpenChange={setShowTeamDetail}
        team={selectedTeam}
      />
    </div>
  );
}
