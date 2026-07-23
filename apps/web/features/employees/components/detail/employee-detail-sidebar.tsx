'use client';

import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMemberAvatarUpload } from '@/hooks/queries/use-image-upload';
import { type EmployeeDetailState, employeeDisplayName } from '../../lib/employee-detail-state';
import { EmployeeWorkspaceStatus } from './employee-workspace-status';

const WORKSPACE_ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

interface EmployeeDetailSidebarProps {
  employee: EmployeeDetailState;
  memberId: string;
  isSelf: boolean;
  canEdit?: boolean;
  isAdmin?: boolean;
  canManageStatus?: boolean;
  canManageRole?: boolean;
  statusUpdatePending?: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  canEditForm?: boolean;
  onSave?: () => void;
  onMemberStatusChange?: (isActive: boolean) => void;
  onInputChange: (field: string, value: string) => void;
  onAvatarUpdated?: (avatarUrl: string) => void;
}

export function EmployeeDetailSidebar({
  employee,
  memberId,
  isSelf,
  canEdit = true,
  canManageStatus = false,
  canManageRole = false,
  statusUpdatePending = false,
  isDirty = false,
  isSaving = false,
  canEditForm = false,
  onSave,
  onMemberStatusChange,
  onInputChange,
  onAvatarUpdated,
}: EmployeeDetailSidebarProps) {
  const displayName = employeeDisplayName(employee);
  const display = (value: string) => value || '—';
  const avatarUpload = useMemberAvatarUpload({ memberId, isSelf });

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="md:w-1/3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{displayName}</CardTitle>
            <CardDescription>{display(employee.position)}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={employee.status === 'Active' ? 'default' : 'outline'}>
              {employee.status}
            </Badge>
            {canEditForm ? (
              <Button size="sm" disabled={!isDirty || isSaving} onClick={onSave}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <AvatarUpload
            src={employee.profileImage}
            alt={displayName}
            fallback={initials}
            disabled={!canEdit || avatarUpload.isPending}
            onUpload={async (file) => {
              const url = await avatarUpload.mutateAsync(file);
              if (url) {
                onAvatarUpdated?.(url);
              }
              return url;
            }}
            onError={(message) => toast.error(message)}
          />

          <div className="space-y-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="preferred-name">Preferred Name (Optional)</Label>
              <Input
                id="preferred-name"
                value={employee.preferredName}
                onChange={(e) => onInputChange('preferredName', e.target.value)}
                placeholder="Enter preferred name"
                readOnly={!canEdit}
                className={!canEdit ? 'bg-muted/50' : undefined}
              />
            </div>

            {canManageRole ? (
              <div className="space-y-2">
                <Label htmlFor="workspace-role">Workspace role</Label>
                <Select
                  value={employee.workspaceRole}
                  onValueChange={(value) => onInputChange('workspaceRole', value)}
                >
                  <SelectTrigger id="workspace-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKSPACE_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-sm font-medium text-muted-foreground">ID:</span>
              <span>{display(employee.employment.employeeId)}</span>
              <span className="text-sm font-medium text-muted-foreground">Dept:</span>
              <span>{display(employee.department)}</span>
              <span className="text-sm font-medium text-muted-foreground">Email:</span>
              <span className="break-all">{employee.email}</span>
              <span className="text-sm font-medium text-muted-foreground">Phone:</span>
              <span>{display(employee.phone)}</span>
              <span className="text-sm font-medium text-muted-foreground">Manager:</span>
              <span>{display(employee.manager)}</span>
            </div>
          </div>

          {canManageStatus && onMemberStatusChange ? (
            <div className="w-full border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Workspace access</p>
              <EmployeeWorkspaceStatus
                displayName={displayName}
                isActive={employee.status === 'Active'}
                isPending={statusUpdatePending}
                onConfirm={onMemberStatusChange}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
