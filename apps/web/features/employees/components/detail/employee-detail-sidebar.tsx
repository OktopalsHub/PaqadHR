'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
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
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const displayName = employeeDisplayName(employee);
  const display = (value: string) => value || '—';
  const avatarUpload = useMemberAvatarUpload({ memberId, isSelf });

  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const employeeDetails = [
    { label: 'Employee ID', value: display(employee.employment.employeeId) },
    { label: 'Department', value: display(employee.department) },
    { label: 'Email', value: employee.email },
    { label: 'Phone', value: display(employee.phone) },
    { label: 'Manager', value: display(employee.manager) },
  ];

  return (
    <div className="xl:w-1/3">
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/30 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{displayName}</CardTitle>
            <CardDescription className="mt-1">{display(employee.position)}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <Badge
              variant={employee.status === 'Active' ? 'default' : 'outline'}
              className="h-3 px-0.5 text-[9px] leading-none"
            >
              {employee.status}
            </Badge>
            {canEditForm ? (
              <Button
                size="sm"
                disabled={!isDirty || isSaving}
                onClick={() => setSaveConfirmationOpen(true)}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-5">
          <div className="flex flex-col items-center gap-3 rounded-md border border-border/70 bg-background p-4 text-center sm:flex-row sm:gap-4 sm:text-left">
            <AvatarUpload
              src={employee.profileImage}
              alt={displayName}
              fallback={initials}
              size="sm"
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
            <div className="min-w-0">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {canEdit ? 'Select the camera icon to update it.' : 'Visible to workspace members.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
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
                  value={employee.workspaceRole || 'member'}
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

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Employee details
              </p>
              <dl className="divide-y rounded-md border border-border/70 bg-background">
                {employeeDetails.map((detail) => (
                  <div
                    key={detail.label}
                    className="grid gap-1 px-3 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">{detail.label}</dt>
                    <dd className="min-w-0 break-words text-sm font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {canManageStatus && onMemberStatusChange ? (
            <div className="border-t pt-5">
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
      <ConfirmActionDialog
        open={saveConfirmationOpen}
        onOpenChange={setSaveConfirmationOpen}
        title="Save employee changes?"
        description="This will update the employee information you have changed."
        actionLabel="Save changes"
        isPending={isSaving}
        onConfirm={() => onSave?.()}
      />
    </div>
  );
}
