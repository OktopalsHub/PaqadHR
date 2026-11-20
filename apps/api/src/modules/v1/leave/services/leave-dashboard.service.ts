import { Injectable } from "@nestjs/common";
import { LeaveStatus } from "src/common/enums";

import { LeaveRepository } from "../leave.repository";

const RECENT_LEAVE_LIMIT = 5;

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

@Injectable()
export class LeaveDashboardService {
  constructor(private readonly leaveRepository: LeaveRepository) {}

  /** `requesterIds` undefined means the whole workspace; otherwise only those members. */
  async getSummary(
    tenantId: string,
    requesterIds: string[] | undefined,
    today?: string,
  ) {
    const day = today ?? localDateKey(new Date());

    const counts = this.leaveRepository
      .createQueryBuilder("leave")
      .select("COUNT(*) FILTER (WHERE leave.status = :pending)", "pending")
      .addSelect(
        "COUNT(*) FILTER (WHERE leave.status = :approved AND leave.startDate <= :day AND leave.endDate >= :day)",
        "onLeaveToday",
      )
      .where("leave.tenantId = :tenantId", { tenantId })
      .setParameters({
        pending: LeaveStatus.PENDING,
        approved: LeaveStatus.APPROVED,
        day,
      });

    const recent = this.leaveRepository
      .createQueryBuilder("leave")
      .leftJoin("leave.requester", "requester")
      .leftJoin("leave.leaveTypes", "leaveType")
      .select([
        "leave.id",
        "leave.startDate",
        "leave.endDate",
        "leave.status",
        "requester.id",
        "requester.firstName",
        "requester.lastName",
        "leaveType.name",
      ])
      .where("leave.tenantId = :tenantId", { tenantId })
      .orderBy("leave.startDate", "DESC")
      .addOrderBy("leave.createdAt", "DESC")
      .limit(RECENT_LEAVE_LIMIT);

    if (requesterIds) {
      if (requesterIds.length === 0) {
        return { pending: 0, onLeaveToday: 0, recent: [] };
      }
      counts.andWhere("leave.requestedBy IN (:...requesterIds)", {
        requesterIds,
      });
      recent.andWhere("leave.requestedBy IN (:...requesterIds)", {
        requesterIds,
      });
    }

    const [countRow, recentRows] = await Promise.all([
      counts.getRawOne<{ pending: string; onLeaveToday: string }>(),
      recent.getMany(),
    ]);

    return {
      pending: Number(countRow?.pending ?? 0),
      onLeaveToday: Number(countRow?.onLeaveToday ?? 0),
      recent: recentRows.map((leave) => ({
        id: leave.id,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status,
        requester: leave.requester
          ? {
              id: leave.requester.id,
              firstName: leave.requester.firstName ?? "",
              lastName: leave.requester.lastName ?? "",
            }
          : null,
        leaveType: leave.leaveTypes ? { name: leave.leaveTypes.name } : null,
      })),
    };
  }
}
