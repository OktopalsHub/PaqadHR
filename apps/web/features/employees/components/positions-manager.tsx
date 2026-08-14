'use client';

import { Edit, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppPage } from '@/components/app-page';
import { LoadingBlock } from '@/components/loading-block';
import { PageActions } from '@/components/page-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AppTable,
  AppTableBodyRow,
  AppTableBodySection,
  AppTableCell,
  AppTableHeadCell,
  AppTableHeaderRow,
  AppTableHeaderSection,
  AppTablePanel,
} from '@/components/ui/app-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea';
import {
  useCreatePosition,
  useDeletePosition,
  usePositions,
  useUpdatePosition,
} from '@/hooks/queries/use-positions';
import type { ApiPosition } from '@/lib/api/positions';
import { useTenant } from '@/providers/tenant-provider';

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

function getPositionStatusStyles(isActive: boolean) {
  return isActive
    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-900'
    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-800';
}

function PositionTable({
  positions,
  onEdit,
  onDelete,
  faded = false,
  canManage = true,
}: {
  positions: ApiPosition[];
  onEdit: (position: ApiPosition) => void;
  onDelete: (id: string) => void;
  faded?: boolean;
  canManage?: boolean;
}) {
  return (
    <AppTablePanel>
      <AppTable className="min-w-[760px]">
        <AppTableHeaderSection>
          <AppTableHeaderRow>
            <AppTableHeadCell>Title</AppTableHeadCell>
            <AppTableHeadCell className="hidden md:table-cell">Description</AppTableHeadCell>
            <AppTableHeadCell>Status</AppTableHeadCell>
            {canManage ? <AppTableHeadCell className="text-right">Actions</AppTableHeadCell> : null}
          </AppTableHeaderRow>
        </AppTableHeaderSection>
        <AppTableBodySection>
          {positions.map((position) => (
            <AppTableBodyRow key={position.id} className={faded ? 'opacity-60' : undefined}>
              <AppTableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: position.color || '#64748b' }}
                  />
                  <span>{position.title}</span>
                </div>
              </AppTableCell>
              <AppTableCell className="hidden max-w-[200px] truncate md:table-cell">
                {position.description || '—'}
              </AppTableCell>
              <AppTableCell>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getPositionStatusStyles(
                    position.isActive,
                  )}`}
                >
                  <span
                    className={`size-1.5 rounded-full ${position.isActive ? 'animate-pulse bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`}
                  />
                  {position.isActive ? 'Active' : 'Inactive'}
                </span>
              </AppTableCell>
              {canManage ? (
                <AppTableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(position)}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void onDelete(position.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </AppTableCell>
              ) : null}
            </AppTableBodyRow>
          ))}
        </AppTableBodySection>
      </AppTable>
    </AppTablePanel>
  );
}

export function PositionsManager({
  hidePageActions = false,
  createOpenExternal,
  setCreateOpenExternal,
}: {
  hidePageActions?: boolean;
  createOpenExternal?: boolean;
  setCreateOpenExternal?: (open: boolean) => void;
}) {
  const { tenant } = useTenant();
  const role = tenant?.member?.role?.toLowerCase();
  const isAdmin = role === 'owner' || role === 'admin';

  const { data: positions = [], isLoading, isError, error } = usePositions();
  const createPosition = useCreatePosition();
  const updatePosition = useUpdatePosition();
  const deletePosition = useDeletePosition();

  const [createOpenInternal, setCreateOpenInternal] = useState(false);
  const createOpen = createOpenExternal !== undefined ? createOpenExternal : createOpenInternal;
  const setCreateOpen =
    setCreateOpenExternal !== undefined ? setCreateOpenExternal : setCreateOpenInternal;
  const [editingPosition, setEditingPosition] = useState<ApiPosition | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState('true');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormIsActive('true');
    setSelectedColor(COLORS[0]);
  };

  const openEdit = (position: ApiPosition) => {
    setFormTitle(position.title);
    setFormDescription(position.description ?? '');
    setFormIsActive(position.isActive ? 'true' : 'false');
    setSelectedColor(position.color ?? COLORS[0]);
    setEditingPosition(position);
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast.error('Position title is required');
      return;
    }

    try {
      await createPosition.mutateAsync({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        isActive: formIsActive === 'true',
        color: selectedColor,
      });
      toast.success('Position created');
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create position');
    }
  };

  const handleUpdate = async () => {
    if (!editingPosition) return;
    if (!formTitle.trim()) {
      toast.error('Position title is required');
      return;
    }

    try {
      await updatePosition.mutateAsync({
        id: editingPosition.id,
        input: {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          isActive: formIsActive === 'true',
          color: selectedColor,
        },
      });
      toast.success('Position updated');
      setEditingPosition(null);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update position');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePosition.mutateAsync(id);
      toast.success('Position deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete position');
    }
  };

  if (isLoading) {
    return (
      <AppPage>
        <LoadingBlock />
      </AppPage>
    );
  }

  if (isError) {
    return (
      <AppPage>
        <Alert variant="destructive">
          <AlertTitle>Unable to load positions</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Something went wrong'}
          </AlertDescription>
        </Alert>
      </AppPage>
    );
  }

  const activePositions = positions.filter((p) => p.isActive);
  const inactivePositions = positions.filter((p) => !p.isActive);

  const formDialog = (
    <div className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="position-title">Title</Label>
        <Input
          id="position-title"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="e.g. Software Engineer"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position-description">Description</Label>
        <Textarea
          id="position-description"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Brief description of this role…"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position-active">Status</Label>
        <Select value={formIsActive} onValueChange={setFormIsActive}>
          <SelectTrigger id="position-active">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 pt-2">
        <Label>Position Color</Label>
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
  );

  const mainContent = (
    <>
      {isAdmin ? (
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          {!hidePageActions && (
            <PageActions>
              <DialogTrigger asChild>
                <Button variant="brandSolid" size="app" className="flex items-center gap-2">
                  <Plus size={16} />
                  <span>Add position</span>
                </Button>
              </DialogTrigger>
            </PageActions>
          )}
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create position</DialogTitle>
            </DialogHeader>
            {formDialog}
            <DialogFooter>
              <Button disabled={createPosition.isPending} onClick={() => void handleCreate()}>
                {createPosition.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Create position
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No positions yet.</p>
          ) : (
            <div className="space-y-6">
              {activePositions.length > 0 ? (
                <PositionTable
                  positions={activePositions}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  canManage={isAdmin}
                />
              ) : null}

              {inactivePositions.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Inactive positions ({inactivePositions.length})
                  </h4>
                  <PositionTable
                    positions={inactivePositions}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    faded
                    canManage={isAdmin}
                  />
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Dialog
          open={editingPosition !== null}
          onOpenChange={(open) => {
            if (!open) {
              setEditingPosition(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit position</DialogTitle>
            </DialogHeader>
            {formDialog}
            <DialogFooter>
              <Button disabled={updatePosition.isPending} onClick={() => void handleUpdate()}>
                {updatePosition.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );

  return <AppPage>{mainContent}</AppPage>;
}
