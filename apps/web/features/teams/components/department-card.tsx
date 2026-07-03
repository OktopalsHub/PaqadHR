import { Building, ChevronDown, ChevronRight, Mail, Phone } from 'lucide-react';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Department } from '@/lib/schemas/department';
import { DepartmentEditButton } from './edit-department-dialog';

interface DepartmentCardProps {
  department: Department;
  isExpanded: boolean;
  onToggle: () => void;
}

export function DepartmentCard({ department, isExpanded, onToggle }: DepartmentCardProps) {
  const memberCount = department.members.length + (department.manager ? 1 : 0);

  const color = department.color || '#64748b';
  const isHexOrRgb = color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl');

  return (
    <Card className="app-card rounded-2xl">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-lg text-white flex items-center justify-center ${!isHexOrRgb ? color : ''}`}
                  style={isHexOrRgb ? { backgroundColor: color } : undefined}
                >
                  <Building size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">{department.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{department.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{memberCount} members</Badge>
                <DepartmentEditButton department={department} />
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
                  <PersonAvatar src={department.manager.avatar} name={department.manager.name} />
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
                  <Badge
                    className={!isHexOrRgb ? `${color} text-white` : 'text-white'}
                    style={isHexOrRgb ? { backgroundColor: color } : undefined}
                  >
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
                    <PersonAvatar
                      src={member.avatar}
                      name={member.name}
                      className="h-10 w-10"
                      fallbackClassName="text-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.role ?? member.position}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
