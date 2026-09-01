import { Building, ChevronDown, ChevronRight, Mail, Phone, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { PersonAvatar } from '@/components/person-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Department } from '@/lib/schemas/department';
import { DepartmentEditButton } from './edit-department-dialog';
import { ManageDepartmentMembersDialog } from './manage-department-members-dialog';

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
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const memberCount = department.members.length + (department.manager ? 1 : 0);
  const memberCountLabel = `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;

  const color = department.color || '#64748b';
  const isHexOrRgb = color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl');

  return (
    <Card className="app-card gap-0 overflow-hidden bg-card/80 py-0 shadow-sm">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${department.name}`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-md text-white ${!isHexOrRgb ? color : ''}`}
                  style={isHexOrRgb ? { backgroundColor: color } : undefined}
                  aria-hidden="true"
                >
                  <Building size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-none font-semibold">
                    {department.name}
                  </span>
                  {department.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {department.description}
                    </span>
                  ) : null}
                </span>
                {isExpanded ? (
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="secondary" className="px-1.5 py-0 text-[11px] font-medium">
                {memberCountLabel}
              </Badge>
              {canManage ? <DepartmentEditButton department={department} /> : null}
              {canManage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Manage ${department.name} members`}
                      onClick={() => setManageMembersOpen(true)}
                    >
                      <UsersRound className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Manage members</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="border-t bg-muted/15 px-5 py-5">
            {department.manager && (
              <div className="mb-5 rounded-md border border-border/70 bg-background p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">Department manager</h4>
                  <Badge
                    className={!isHexOrRgb ? `${color} text-white` : 'text-white'}
                    style={isHexOrRgb ? { backgroundColor: color } : undefined}
                  >
                    Manager
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <PersonAvatar src={department.manager.avatar} name={department.manager.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{department.manager.name}</p>
                    <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex min-w-0 items-center gap-1">
                        <Mail size={12} />
                        <span className="truncate">{department.manager.email}</span>
                      </div>
                      {department.manager.phone && (
                        <div className="flex items-center gap-1">
                          <Phone size={12} />
                          {department.manager.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium">Team members</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    People assigned to this department.
                  </p>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {department.members.length}
                </Badge>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3">
                {department.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex min-w-0 items-center gap-3 rounded-md border border-border/70 bg-background p-3.5 transition-colors hover:border-primary/30 hover:bg-muted/30"
                  >
                    <PersonAvatar
                      src={member.avatar}
                      name={member.name}
                      className="h-10 w-10"
                      fallbackClassName="text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {member.position || member.role || 'Team member'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      <ManageDepartmentMembersDialog
        department={department}
        open={manageMembersOpen}
        onOpenChange={setManageMembersOpen}
      />
    </Card>
  );
}
