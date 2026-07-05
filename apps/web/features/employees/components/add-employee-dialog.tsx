'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
            <DialogDescription>
              Choose department and position, then send an invitation by email. They will set up
              their profile when they accept.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="department">Department</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCreateDepartmentOpen(true)}
                >
                  <Plus className="size-3" />
                  New department
                </Button>
              </div>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="position">Position</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCreatePositionOpen(true)}
                >
                  <Plus className="size-3" />
                  New position
                </Button>
              </div>
              <Select value={positionId} onValueChange={setPositionId}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="Select position (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {activePositions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
