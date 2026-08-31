'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SearchSelect } from '@/components/search-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmployees, useUpdateEmployeeOrganization } from '@/hooks/queries/use-employees';
import type { Department } from '@/lib/schemas/department';

type Props = {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ManageDepartmentMembersDialog({ department, open, onOpenChange }: Props) {
  const { data: employees = [], isLoading } = useEmployees();
  const updateOrganization = useUpdateEmployeeOrganization();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<
    Department['members'][number] | null
  >(null);

  const options = useMemo(
    () =>
      employees
        .filter(
          (employee) => employee.status === 'Active' && employee.department !== department.name,
        )
        .map((employee) => ({
          value: employee.id,
          label: `${employee.name}${employee.department ? ` — ${employee.department}` : ''}`,
        })),
    [department.name, employees],
  );

  const addMember = async () => {
    if (!selectedMemberId) {
      toast.error('Select an employee to add');
      return;
    }
    try {
      await updateOrganization.mutateAsync({
        memberId: selectedMemberId,
        departmentId: department.id,
      });
      toast.success('Employee added to department');
      setSelectedMemberId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to add employee');
    }
  };

  const removeMember = async () => {
    if (!memberPendingRemoval) return;
    try {
      await updateOrganization.mutateAsync({
        memberId: memberPendingRemoval.id,
        departmentId: null,
      });
      toast.success('Employee removed from department');
      setMemberPendingRemoval(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove employee');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle>Manage {department.name} members</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium">Add employee</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SearchSelect
                  options={options}
                  value={selectedMemberId}
                  onValueChange={setSelectedMemberId}
                  placeholder="Select an employee"
                  searchPlaceholder="Search employees…"
                  emptyMessage="No eligible employees found."
                  disabled={isLoading || updateOrganization.isPending}
                  className="min-w-0 flex-1"
                />
                <Button
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => void addMember()}
                  disabled={updateOrganization.isPending}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Adding an employee moves them from their current department.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Current members</p>
              {department.members.length ? (
                <div className="divide-y rounded-lg border border-border/60">
                  {department.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.position || member.email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setMemberPendingRemoval(member)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No employees in this department yet.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(memberPendingRemoval)}
        onOpenChange={(next) => !next && setMemberPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove employee from department?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberPendingRemoval?.name} will no longer belong to {department.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void removeMember()}
            >
              Remove employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
