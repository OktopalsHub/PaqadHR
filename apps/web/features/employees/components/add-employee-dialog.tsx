'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/search-select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateDepartmentDialog } from '@/features/teams/components/create-department-dialog';
import { useDepartments } from '@/hooks/queries/use-departments';
import { usePositions } from '@/hooks/queries/use-positions';
import { createEmployeeInvite } from '@/lib/api/employees';
import { toastInvitationDelivery } from '@/lib/invitation-delivery';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { CreatePositionDialog } from './create-position-dialog';

// Define the props for the AddEmployeeDialog component
interface AddEmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const INVITE_ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const;

export const AddEmployeeDialog = ({ isOpen, onOpenChange }: AddEmployeeDialogProps) => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]['value']>('member');
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createDepartmentOpen, setCreateDepartmentOpen] = useState(false);
  const [createPositionOpen, setCreatePositionOpen] = useState(false);

  const activePositions = positions.filter((position) => position.isActive);

  const departmentOptions = useMemo(
    () => departments.map((dept) => ({ value: dept.id, label: dept.name })),
    [departments],
  );

  const positionOptions = useMemo(
    () => activePositions.map((position) => ({ value: position.id, label: position.title })),
    [activePositions],
  );

  const resetForm = () => {
    setEmail('');
    setRole('member');
    setDepartmentId('');
    setPositionId('');
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEmployeeInvite({
        email: email.trim(),
        role,
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
      });

      toastInvitationDelivery(result, {
        successMessage: 'Invitation sent',
        failureMessage: 'Invitation saved, email not sent',
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.employees.all, tenantId],
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.all,
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation';
      if (message.includes('already been sent')) {
        toast.error('Invitation already pending', {
          description: 'Resend or revoke from the Invitations tab.',
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite employee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <SearchSelect
                options={departmentOptions}
                value={departmentId}
                onValueChange={setDepartmentId}
                placeholder="Optional"
                searchPlaceholder="Search…"
                emptyMessage="No departments"
                footer={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-1"
                    onClick={() => setCreateDepartmentOpen(true)}
                  >
                    <Plus className="size-3" />
                    New department
                  </Button>
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">Position</Label>
              <SearchSelect
                options={positionOptions}
                value={positionId}
                onValueChange={setPositionId}
                placeholder="Optional"
                searchPlaceholder="Search…"
                emptyMessage="No positions"
                footer={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-1"
                    onClick={() => setCreatePositionOpen(true)}
                  >
                    <Plus className="size-3" />
                    New position
                  </Button>
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateDepartmentDialog
        open={createDepartmentOpen}
        onOpenChange={setCreateDepartmentOpen}
        onCreated={setDepartmentId}
      />
      <CreatePositionDialog
        open={createPositionOpen}
        onOpenChange={setCreatePositionOpen}
        onCreated={setPositionId}
      />
    </>
  );
};
