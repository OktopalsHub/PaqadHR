'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { useDeleteDepartment, useUpdateDepartment } from '@/hooks/queries/use-departments';
import type { Department } from '@/lib/schemas/department';

const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

interface EditDepartmentDialogProps {
  department: Department;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDepartmentDialog({
  department,
  open,
  onOpenChange,
}: EditDepartmentDialogProps) {
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description ?? '');
  const [selectedColor, setSelectedColor] = useState(department.color ?? COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reset = () => {
    setName(department.name);
    setDescription(department.description ?? '');
    setSelectedColor(department.color ?? COLORS[0]);
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    if (name.trim().length < 2) {
      toast.error('Department name must be at least 2 characters');
      return;
    }
    try {
      await updateDepartment.mutateAsync({
        id: department.id,
        input: {
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor,
        },
      });
      toast.success('Department updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update department');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDepartment.mutateAsync(department.id);
      toast.success('Department deleted');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete department');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit department</DialogTitle>
        </DialogHeader>

        {confirmDelete ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{department.name}</strong>? This cannot be
              undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteDepartment.isPending}
                onClick={() => void handleDelete()}
              >
                {deleteDepartment.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dept-name">Name</Label>
              <Input id="edit-dept-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="edit-dept-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="size-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{
                      backgroundColor: color,
                      borderColor: selectedColor === color ? '#000' : 'transparent',
                      boxShadow: selectedColor === color ? '0 0 0 2px white inset' : 'none',
                    }}
                    onClick={() => setSelectedColor(color)}
                    aria-label={`Select color ${color}`}
                  />
                ))}
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="size-7 rounded-full cursor-pointer border border-border bg-transparent"
                  title="Custom color"
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="size-4 rounded-full border border-black/10"
                  style={{ backgroundColor: selectedColor }}
                />
                <span className="text-xs text-muted-foreground">{selectedColor}</span>
              </div>
            </div>

            <DialogFooter className="flex-row justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Button>
              <Button
                type="button"
                disabled={updateDepartment.isPending}
                onClick={() => void handleSave()}
              >
                {updateDepartment.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DepartmentActionsProps {
  department: Department;
}

export function DepartmentEditButton({ department }: DepartmentActionsProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Edit department"
      >
        <Pencil className="size-3.5" />
      </Button>
      <EditDepartmentDialog department={department} open={open} onOpenChange={setOpen} />
    </>
  );
}
