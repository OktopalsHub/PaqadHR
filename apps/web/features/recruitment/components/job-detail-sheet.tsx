'use client';

import { Archive, Ban, MoreHorizontal, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LoadingBlock } from '@/components/loading-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  useArchiveJobOpening,
  useCloseJobOpening,
  useDeactivateJobOpening,
  useDeleteJobOpening,
  useJobOpening,
} from '@/hooks/queries/use-recruitment';
import { formatDate } from '@/lib/format-date';

type JobDetailSheetProps = {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatEmploymentType(value?: string) {
  if (!value) return '—';
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join('-');
}

function formatLocationType(value?: string) {
  if (!value) return '—';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function JobDetailSheet({ jobId, open, onOpenChange }: JobDetailSheetProps) {
  const { data: job, isLoading, isError } = useJobOpening(open ? jobId : null);
  const deactivate = useDeactivateJobOpening();
  const close = useCloseJobOpening();
  const archive = useArchiveJobOpening();
  const deleteJob = useDeleteJobOpening();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleAction = async (
    action: () => Promise<unknown>,
    label: string,
    successMsg: string,
  ) => {
    try {
      await action();
      toast.success(successMsg);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${label.toLowerCase()}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading ? (
          <LoadingBlock />
        ) : isError || !job ? (
          <p className="text-sm text-muted-foreground">Unable to load job details.</p>
        ) : (
          <>
            <SheetHeader className="flex flex-row items-start justify-between">
              <SheetTitle>{job.title}</SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {job.status === 'ACTIVE' && (
                    <DropdownMenuItem
                      onClick={() =>
                        handleAction(
                          () => deactivate.mutateAsync(job.id),
                          'Deactivate',
                          'Job deactivated',
                        )
                      }
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Deactivate
                    </DropdownMenuItem>
                  )}
                  {job.status !== 'CLOSED' && job.status !== 'ARCHIVED' && (
                    <DropdownMenuItem
                      onClick={() =>
                        handleAction(() => close.mutateAsync(job.id), 'Close', 'Job closed')
                      }
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Close
                    </DropdownMenuItem>
                  )}
                  {job.status === 'CLOSED' && (
                    <DropdownMenuItem
                      onClick={() =>
                        handleAction(() => archive.mutateAsync(job.id), 'Archive', 'Job archived')
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  )}
                  {job.status !== 'ARCHIVED' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SheetHeader>

            <div className="mt-4 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{job.status.toLowerCase()}</Badge>
                {job.isUrgent ? <Badge variant="destructive">Urgent</Badge> : null}
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium">{job.departmentName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="font-medium">{job.position ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Employment</dt>
                    <dd className="font-medium">{formatEmploymentType(job.employmentType)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Experience</dt>
                    <dd className="font-medium">{job.experienceLevel ?? '—'}</dd>
                  </div>
                </div>
                {job.location ? (
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">
                      {formatLocationType(job.location.type)}
                      {[job.location.city, job.location.country].filter(Boolean).join(', ')}
                    </dd>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  {job.numberOfOpenings != null ? (
                    <div>
                      <dt className="text-muted-foreground">Openings</dt>
                      <dd className="font-medium">{job.numberOfOpenings}</dd>
                    </div>
                  ) : null}
                  {job.applicationDeadline ? (
                    <div>
                      <dt className="text-muted-foreground">Deadline</dt>
                      <dd className="font-medium">{formatDate(job.applicationDeadline)}</dd>
                    </div>
                  ) : null}
                </div>
              </dl>

              {job.description ? (
                <div>
                  <h3 className="text-sm font-semibold">Description</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {job.description}
                  </p>
                </div>
              ) : null}

              {job.requirements && job.requirements.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Requirements</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {job.requirements.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {job.responsibilities && job.responsibilities.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Responsibilities</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {job.responsibilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job Opening</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{job?.title}&rdquo;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteJob.isPending}
              onClick={async () => {
                if (!job) return;
                try {
                  await deleteJob.mutateAsync(job.id);
                  toast.success('Job deleted');
                  setConfirmDelete(false);
                  onOpenChange(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete job');
                }
              }}
            >
              {deleteJob.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
