"use client";

import { useState } from "react";
import { ContentCard } from "@/components/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Users, UserPlus, Settings, MoreHorizontal, Target } from "lucide-react";
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
    <div className="space-y-5">
      <ContentCard
        title="Teams"
        description="Manage teams and departments"
        action={
          <Button size="sm" className="h-8 rounded-lg text-xs">
            <UserPlus className="mr-1.5 size-3.5" />
            Create team
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <article
              key={team.id}
              className="app-card rounded-xl p-4 transition-colors hover:border-primary/25"
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline">{team.department}</Badge>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </div>

              <h3 className="mt-2 text-base font-semibold">{team.name}</h3>

              <div className="mt-3 flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarImage src={team.lead.avatar} />
                  <AvatarFallback className="text-xs">
                    {team.lead.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{team.lead.name}</p>
                  <p className="text-xs text-muted-foreground">Team lead</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span>{team.members} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-muted-foreground" />
                  <span>{team.projects} projects</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Performance</span>
                  <span className="font-medium">{team.performance}%</span>
                </div>
                <Progress value={team.performance} className="h-2" />
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">
                  ${team.budget.toLocaleString()}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 text-xs"
                  onClick={() => handleViewTeam(team)}
                >
                  View details
                </Button>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <Settings className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </ContentCard>

      <TeamDetailDialog
        open={showTeamDetail}
        onOpenChange={setShowTeamDetail}
        team={selectedTeam}
      />
    </div>
  );
}
