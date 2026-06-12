import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Building, ChevronDown, ChevronRight, Mail, Phone } from "lucide-react";
import type { Department } from "@/lib/schemas/department";

interface DepartmentCardProps {
  department: Department;
  isExpanded: boolean;
  onToggle: () => void;
}

export function DepartmentCard({
  department,
  isExpanded,
  onToggle,
}: DepartmentCardProps) {
  const memberCount = department.members.length + (department.manager ? 1 : 0);

  return (
    <Card className="glass-card">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`${department.color} p-3 rounded-lg text-white`}
                >
                  <Building size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{department.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {department.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{memberCount} members</Badge>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {department.manager && (
              <div className="mb-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Department Manager</h4>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={department.manager.avatar} />
                    <AvatarFallback>{department.manager.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{department.manager.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail size={12} />
                        {department.manager.email}
                      </div>
                      {department.manager.phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={12} />
                          {department.manager.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className={`${department.color} text-white`}>
                    Manager
                  </Badge>
                </div>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-3">Team Members</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {department.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="text-sm">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.role ?? member.position}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
