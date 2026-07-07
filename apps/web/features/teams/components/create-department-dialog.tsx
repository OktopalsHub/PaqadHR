'use client';

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
import { useCreateDepartment } from '@/hooks/queries/use-departments';

type CreateDepartmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
};

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

export function CreateDepartmentDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDepartmentDialogProps) {
  const createDepartment = useCreateDepartment();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const reset = () => {
    setName('');
    setDescription('');
    setSelectedColor(COLORS[0]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Department name must be at least 2 characters');
      return;
    }

    try {
      const created = await createDepartment.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
      });
      toast.success('Department created');
      onCreated?.(created.id);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create department');
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
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Add department</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="department-name">Name</Label>
              <Input
                id="department-name"
                placeholder="Engineering"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="department-description"
                placeholder="What does this department do?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2 pt-2">
              <Label>Department Color</Label>
              <div className="flex flex-wrap gap-2 items-center pt-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`size-6 rounded-full border transition-all ${
                      selectedColor === color
                        ? 'ring-2 ring-primary ring-offset-2 border-transparent scale-110'
                        : 'border-black/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
                <div
                  className="relative size-6 rounded-full border border-black/10 overflow-hidden cursor-pointer flex items-center justify-center hover:scale-105"
                  style={{
                    backgroundColor: COLORS.includes(selectedColor) ? '#ffffff' : selectedColor,
                  }}
                >
                  <input
                    type="color"
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                  />
                  <span
                    className="text-xs font-semibold select-none pointer-events-none"
                    style={{ color: COLORS.includes(selectedColor) ? '#71717a' : '#ffffff' }}
                  >
                    +
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDepartment.isPending}>
              {createDepartment.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
