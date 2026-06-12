export interface AssignmentResult {
  memberId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  allocatedDays: number;
  balanceId: string;
}
export interface RemovalResult {
  memberId: string;
  balanceId: string;
  removedDays: number;
}
export interface AssignmentToAllUsersResult {
  memberId: string;
  balanceId: string;
  allocatedDays: number;
}
export interface MissingLeaveType {
  leaveTypeId: string;
  leaveTypeName: string;
  defaultDays: number;
}
export interface MissingAssignment {
  memberId: string;
  memberName: string;
  missingTypes: MissingLeaveType[];
}
export interface CarryoverExpirationResult {
  tenantId: string;
  expiredBalances: number;
  totalExpiredDays: number;
}
