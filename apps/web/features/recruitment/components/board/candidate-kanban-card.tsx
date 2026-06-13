import { FileText, Percent } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type CandidateCardData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  summary?: string;
  fileCount?: number;
  matchScore?: number;
};

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

type CandidateKanbanCardProps = {
  candidate: CandidateCardData;
  className?: string;
  isDragging?: boolean;
};

export function CandidateKanbanCard({
  candidate,
  className,
  isDragging,
}: CandidateKanbanCardProps) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <article
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/30",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium">
            {initials(candidate.firstName, candidate.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {candidate.email}
          </p>
        </div>
      </div>

      {candidate.summary ? (
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {candidate.summary}
        </p>
      ) : null}

      {(candidate.fileCount != null || candidate.matchScore != null) && (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          {candidate.fileCount != null ? (
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3" />
              {candidate.fileCount} file{candidate.fileCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {candidate.matchScore != null ? (
            <span className="inline-flex items-center gap-1">
              <Percent className="size-3" />
              {candidate.matchScore}%
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}
