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
import { CreateDepartmentDialog } from '@/features/teams/components/create-department-dialog';
import { useDepartments } from '@/hooks/queries/use-departments';
import { usePositions } from '@/hooks/queries/use-positions';
import { createEmployeeInvite } from '@/lib/api/employees';
import { queryKeys } from '@/lib/query/keys';
import { useTenant } from '@/providers/tenant-provider';
import { CreatePositionDialog } from './create-position-dialog';

interface AddEmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddEmployeeDialog = ({ isOpen, onOpenChange }: AddEmployeeDialogProps) => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();
  const [email, setEmail] = useState('');
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
    setDepartmentId('');
    setPositionId('');
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error('Email is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createEmployeeInvite({
        email: email.trim(),
        role: 'member',
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
      });

      toast.success('Invitation sent successfully.');
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
        toast.error(message, {
          description: 'Open the Invitations tab to resend or revoke.',
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
            <DialogTitle>Add employee</DialogTitle>
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
              <Label htmlFor="department">Department</Label>
              <SearchSelect
                options={departmentOptions}
                value={departmentId}
                onValueChange={setDepartmentId}
                placeholder="Department (optional)"
                searchPlaceholder="Search departments…"
                emptyMessage="No departments found."
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
                placeholder="Position (optional)"
                searchPlaceholder="Search positions…"
                emptyMessage="No positions found."
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
              {isSubmitting ? 'Sending…' : 'Send invitation'}
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
