'use client';

import { toast } from 'sonner';
import { AvatarUpload } from '@/components/avatar-upload';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMemberAvatarUpload } from '@/hooks/queries/use-image-upload';
import { employeeDisplayName, type EmployeeDetailState } from '../../lib/employee-detail-state';

interface EmployeeDetailSidebarProps {
  employee: EmployeeDetailState;
  memberId: string;
  isSelf: boolean;
  canEdit?: boolean;
  onInputChange: (field: string, value: string) => void;
  onAvatarUpdated?: (avatarUrl: string) => void;
}

export function EmployeeDetailSidebar({
  employee,
  memberId,
  isSelf,
  canEdit = true,
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
          <Badge variant={employee.status === 'Active' ? 'default' : 'outline'}>
            {employee.status}
          </Badge>
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
        </CardContent>
      </Card>
    </div>
  );
}
