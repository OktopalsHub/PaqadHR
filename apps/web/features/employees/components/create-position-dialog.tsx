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
import { useCreatePosition } from '@/hooks/queries/use-positions';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#64748b',
];

type CreatePositionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
};

export function CreatePositionDialog({ open, onOpenChange, onCreated }: CreatePositionDialogProps) {
  const createPosition = useCreatePosition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setSelectedColor(COLORS[0]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 2) {
      toast.error('Position title must be at least 2 characters');
      return;
    }

    try {
      const created = await createPosition.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
        isActive: true,
      });
      toast.success('Position created');
      onCreated?.(created.id);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create position');
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
            <DialogTitle>Add position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="position-title">Title</Label>
              <Input
                id="position-title"
                placeholder="Software Engineer"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="position-description"
                placeholder="Brief description of this role"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 pt-2">
              <Label>Position color</Label>
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
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPosition.isPending}>
              {createPosition.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
