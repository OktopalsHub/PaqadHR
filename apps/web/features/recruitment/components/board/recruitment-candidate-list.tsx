import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BOARD_COLUMNS,
  DISQUALIFIED_STATUSES,
  columnForStatus,
  type CandidateStatus,
} from "./board-columns";
import type { BoardCandidate } from "./recruitment-kanban-board";

function formatStatus(status: CandidateStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function CandidateListRow({ candidate }: { candidate: BoardCandidate }) {
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-muted text-[10px] font-medium">
          {candidate.firstName.charAt(0)}
          {candidate.lastName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{fullName}</p>
          <Badge variant="outline" className="text-[10px]">
            {formatStatus(candidate.status)}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.email}
        </p>
        {candidate.summary ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {candidate.summary}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type RecruitmentCandidateListProps = {
  candidates: BoardCandidate[];
};

export function RecruitmentCandidateList({
  candidates,
}: RecruitmentCandidateListProps) {
  const disqualified = candidates.filter((candidate) =>
    DISQUALIFIED_STATUSES.includes(candidate.status),
  );

  const qualified = candidates.filter(
    (candidate) => !DISQUALIFIED_STATUSES.includes(candidate.status),
  );

  const groups = [
    ...BOARD_COLUMNS.map((column) => ({
      id: column.id,
      title: column.title,
      items: qualified.filter(
        (candidate) => columnForStatus(candidate.status) === column.id,
      ),
    })),
    {
      id: "disqualified",
      title: "Disqualified",
      items: disqualified,
    },
  ].filter((group) => group.items.length > 0);

  if (candidates.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No candidates match your search.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {group.items.length}
            </span>
          </div>
          <div className="space-y-2">
            {group.items.map((candidate) => (
              <CandidateListRow key={candidate.id} candidate={candidate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
