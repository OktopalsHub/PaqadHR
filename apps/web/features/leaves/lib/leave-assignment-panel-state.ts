import type { LeaveAssignmentReport, MissingLeaveAssignment } from '@/lib/api/leave-assignments';

export type LeaveAssignmentPanelState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'complete';
      title: string;
      description: string;
    }
  | {
      kind: 'missing';
      totals: {
        members: number;
        complete: number;
        missing: number;
      };
      rows: Array<{
        memberId: string;
        memberLabel: string;
        missingTypes: MissingLeaveAssignment['missingTypes'];
        missingCount: number;
      }>;
    };

export function getLeaveAssignmentPanelState({
  report,
  isLoading,
  year,
}: {
  report?: LeaveAssignmentReport | null;
  isLoading: boolean;
  year: number;
}): LeaveAssignmentPanelState {
  if (isLoading) {
    return { kind: 'loading' };
  }

  if (!report) {
    return {
      kind: 'error',
      message: `Unable to load assignment data for ${year}.`,
    };
  }

  const missingAssignments = report.missingAssignments ?? [];

  if (missingAssignments.length === 0) {
    return {
      kind: 'complete',
      title: `All active members have every leave type assigned for ${year}.`,
      description: `${report.completeAssignments} of ${report.totalMembers} members are fully configured.`,
    };
  }

  return {
    kind: 'missing',
    totals: {
      members: report.totalMembers,
      complete: report.completeAssignments,
      missing: missingAssignments.length,
    },
    rows: missingAssignments.map((entry) => ({
      memberId: entry.memberId,
      memberLabel: entry.memberName || entry.memberId,
      missingTypes: entry.missingTypes,
      missingCount: entry.missingTypes.length,
    })),
  };
}
