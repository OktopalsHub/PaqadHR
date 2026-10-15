import type { Address } from '../../address/entities/address.entity';
import type { Attendance } from '../../attendance/entities/attendance.entity';
import type { Document } from '../../document/entities/document.entity';
import type { Education } from '../../education/entities/education.entity';
import type { EmergencyContact } from '../../emergency-contact/entities/emergency-contact.entity';
import type { Employment } from '../../employment/entities/employment.entity';
import type { Leave } from '../../leave/entities/leave.entity';
import type { Notification } from '../../notifications/entities/notification.entity';
import type { NotificationPreference } from '../../notifications/entities/notification-preference.entity';
import type { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import type { PayrollItem } from '../../payroll/entities/payroll-item.entity';
import type { TenantMember } from '../entities/tenant-member.entity';

export type DecryptFn = (value?: string | null) => string | null;

export function mapMembership(
  member: TenantMember & { tenant?: { name?: string } },
  decrypt: DecryptFn,
) {
  return {
    id: member.id,
    tenantId: member.tenantId,
    tenantName: member.tenant?.name,
    role: member.role,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone,
    dateOfBirth: member.dateOfBirth,
    gender: member.gender,
    identityBvn: decrypt(member.identityBvn),
    identityNin: decrypt(member.identityNin),
    joinDate: member.joinDate,
    leaveDate: member.leaveDate,
    isActive: member.isActive,
  };
}

export function mapEmployment(row: Employment) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    tenantId: row.tenantId,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    payType: row.payType,
    paySchedule: row.paySchedule,
    payRate: row.payRate,
    currency: row.currency,
    comments: row.comments,
  };
}

export function mapDocument(row: Document) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    tenantId: row.tenantId,
    name: row.name,
    type: row.type,
    fileKey: row.fileKey,
    issueDate: row.issueDate,
    expiryDate: row.expiryDate,
    description: row.description,
    isVerified: row.isVerified,
  };
}

export function mapLeave(row: Leave) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requestedBy: row.requestedBy,
    leaveTypeId: row.leaveTypeId,
    startDate: row.startDate,
    endDate: row.endDate,
    duration: row.duration,
    status: row.status,
    reason: row.reason,
    comments: row.comments,
  };
}

export function mapAttendance(row: Attendance) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    tenantId: row.tenantId,
    date: row.date,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
    workHours: row.workHours,
    status: row.status,
    notes: row.notes,
  };
}

export function mapEducation(row: Education) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    tenantId: row.tenantId,
    title: row.title,
    degreeType: row.degreeType,
    institution: row.institution,
    fieldOfStudy: row.fieldOfStudy,
    startDate: row.startDate,
    endDate: row.endDate,
    description: row.description,
    gpa: row.gpa,
  };
}

export function mapEmergencyContact(row: EmergencyContact) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    tenantId: row.tenantId,
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    email: row.email,
    relationship: row.relationship,
    address: row.address,
    isPrimary: row.isPrimary,
  };
}

export function mapAddress(row: Address) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    country: row.country,
    city: row.city,
    state: row.state,
    street: row.street,
    postalCode: row.postalCode,
  };
}

export function mapPayrollItem(row: PayrollItem) {
  return {
    id: row.id,
    memberId: row.memberId,
    payrollRunId: row.payrollRunId,
    status: row.status,
    baseSalary: row.baseSalary,
    baseSalaryCurrency: row.baseSalaryCurrency,
    grossAmount: row.grossAmount,
    adjustments: row.adjustments,
    deductions: row.deductions,
    netAmount: row.netAmount,
    paymentCurrency: row.paymentCurrency,
    paymentAmount: row.paymentAmount,
    exchangeRate: row.exchangeRate,
    paidAt: row.paidAt,
    description: row.description,
  };
}

export function mapPaymentMethod(row: PaymentMethod, decrypt: DecryptFn) {
  return {
    id: row.id,
    memberId: row.memberId,
    tenantId: row.tenantId,
    type: row.type,
    currency: row.currency,
    bankName: row.bankName,
    bankCode: row.bankCode,
    accountName: decrypt(row.accountName),
    accountNumber: decrypt(row.accountNumber),
    country: row.country,
    isPrimary: row.isPrimary,
    status: row.status,
    displayName: row.displayName,
  };
}

export function mapNotificationPreference(row: NotificationPreference) {
  return {
    id: row.id,
    tenantMemberId: row.tenantMemberId,
    notificationType: row.notificationType,
    preferredChannel: row.preferredChannel,
    isEnabled: row.isEnabled,
    emailEnabled: row.emailEnabled,
    inAppEnabled: row.inAppEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    quietDays: row.quietDays,
  };
}

export function mapNotification(row: Notification) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    recipientId: row.recipientId,
    type: row.type,
    channel: row.channel,
    priority: row.priority,
    status: row.status,
    title: row.title,
    message: row.message,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
    readAt: row.readAt,
    expiresAt: row.expiresAt,
  };
}
