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
  canManage?: boolean;
}

export function DepartmentCard({
  department,
  isExpanded,
  onToggle,
  canManage = false,
}: DepartmentCardProps) {
  const memberCount = department.members.length + (department.manager ? 1 : 0);

  const color = department.color || '#64748b';
  const isHexOrRgb = color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl');

  return (
    <Card className="app-card gap-0 bg-card/80 py-0 shadow-sm">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer px-4 py-3.5 transition-colors hover:bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-md text-white ${!isHexOrRgb ? color : ''}`}
                  style={isHexOrRgb ? { backgroundColor: color } : undefined}
                >
                  <Building size={14} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm">{department.name}</CardTitle>
                  {department.description ? (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {department.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <Badge variant="secondary" className="px-1.5 py-0 text-[11px] font-medium">
                  {memberCount} members
                </Badge>
                {canManage ? <DepartmentEditButton department={department} /> : null}
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
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
                    <p className="font-medium truncate min-w-0">{member.name}</p>
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
