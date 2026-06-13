"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoadingBlock } from "@/components/loading-block";
import { useJobOpening } from "@/hooks/queries/use-recruitment";
import { formatDate } from "@/lib/format-date";

type JobDetailSheetProps = {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatEmploymentType(value?: string) {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join("-");
}

function formatLocationType(value?: string) {
  if (!value) return "—";
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
}: JobDetailSheetProps) {
  const { data: job, isLoading, isError } = useJobOpening(open ? jobId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {isLoading ? (
          <LoadingBlock />
        ) : isError || !job ? (
          <p className="text-sm text-muted-foreground">
            Unable to load job details.
          </p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{job.title}</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{job.status.toLowerCase()}</Badge>
                {job.isUrgent ? (
                  <Badge variant="destructive">Urgent</Badge>
                ) : null}
              </div>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Department</dt>
                  <dd className="font-medium">
                    {job.departmentName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Position</dt>
                  <dd className="font-medium">{job.position ?? "—"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-muted-foreground">Employment</dt>
                    <dd className="font-medium">
                      {formatEmploymentType(job.employmentType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Experience</dt>
                    <dd className="font-medium">
                      {job.experienceLevel ?? "—"}
                    </dd>
                  </div>
                </div>
                {job.location ? (
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium">
                      {formatLocationType(job.location.type)}
                      {[job.location.city, job.location.country]
                        .filter(Boolean)
                        .join(", ")}
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
                      <dd className="font-medium">
                        {formatDate(job.applicationDeadline)}
                      </dd>
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
    </Sheet>
  );
}
