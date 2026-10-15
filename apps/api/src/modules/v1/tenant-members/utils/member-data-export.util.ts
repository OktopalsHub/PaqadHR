import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import { Address } from '../../address/entities/address.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { Document } from '../../document/entities/document.entity';
import { Education } from '../../education/entities/education.entity';
import { EmergencyContact } from '../../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { Leave } from '../../leave/entities/leave.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { NotificationPreference } from '../../notifications/entities/notification-preference.entity';
import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { PayrollItem } from '../../payroll/entities/payroll-item.entity';
import { TenantMember } from '../entities/tenant-member.entity';
import {
  type DecryptFn,
  mapAddress,
  mapAttendance,
  mapDocument,
  mapEducation,
  mapEmergencyContact,
  mapEmployment,
  mapLeave,
  mapMembership,
  mapNotification,
  mapNotificationPreference,
  mapPaymentMethod,
  mapPayrollItem,
} from './member-export-mappers';

const EMPTY_EXPORT = {
  memberships: [],
  employment: [],
  documents: [],
  leaves: [],
  attendance: [],
  education: [],
  emergencyContacts: [],
  addresses: [],
  payrollItems: [],
  paymentMethods: [],
  notificationPreferences: [],
  notifications: [],
};

export async function loadMemberPersonalDataForExport(
  dataSource: DataSource,
  userId: string,
  decryptOptional: DecryptFn,
): Promise<Record<string, unknown>> {
  const manager = dataSource.manager;
  const members = await manager.getRepository(TenantMember).find({
    where: { userId },
    relations: ['tenant'],
  });
  const memberIds = members.map((m) => m.id);
  if (memberIds.length === 0) return EMPTY_EXPORT;

  const [
    employments,
    documents,
    leaves,
    attendances,
    educations,
    emergencyContacts,
    addresses,
    payrollItems,
    paymentMethods,
    notificationPreferences,
    notifications,
  ] = await Promise.all([
    manager.getRepository(Employment).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'tenantId',
        'startDate',
        'endDate',
        'status',
        'payType',
        'paySchedule',
        'payRate',
        'currency',
        'comments',
      ],
    }),
    manager.getRepository(Document).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'tenantId',
        'name',
        'type',
        'fileKey',
        'issueDate',
        'expiryDate',
        'description',
        'isVerified',
      ],
    }),
    manager.getRepository(Leave).find({
      where: { requestedBy: In(memberIds) },
      select: [
        'id',
        'tenantId',
        'requestedBy',
        'leaveTypeId',
        'startDate',
        'endDate',
        'duration',
        'status',
        'reason',
        'comments',
      ],
    }),
    manager.getRepository(Attendance).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'tenantId',
        'date',
        'clockIn',
        'clockOut',
        'workHours',
        'status',
        'notes',
      ],
    }),
    manager.getRepository(Education).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'tenantId',
        'title',
        'degreeType',
        'institution',
        'fieldOfStudy',
        'startDate',
        'endDate',
        'description',
        'gpa',
      ],
    }),
    manager.getRepository(EmergencyContact).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'tenantId',
        'fullName',
        'phoneNumber',
        'email',
        'relationship',
        'address',
        'isPrimary',
      ],
    }),
    manager.getRepository(Address).find({
      where: { tenantMemberId: In(memberIds) },
      select: ['id', 'tenantMemberId', 'country', 'city', 'state', 'street', 'postalCode'],
    }),
    manager.getRepository(PayrollItem).find({
      where: { memberId: In(memberIds) },
      select: [
        'id',
        'memberId',
        'payrollRunId',
        'status',
        'baseSalary',
        'baseSalaryCurrency',
        'grossAmount',
        'adjustments',
        'deductions',
        'netAmount',
        'paymentCurrency',
        'paymentAmount',
        'exchangeRate',
        'paidAt',
        'description',
      ],
    }),
    manager.getRepository(PaymentMethod).find({
      where: { memberId: In(memberIds) },
      select: [
        'id',
        'memberId',
        'tenantId',
        'type',
        'currency',
        'bankName',
        'bankCode',
        'accountName',
        'accountNumber',
        'country',
        'isPrimary',
        'status',
        'displayName',
      ],
    }),
    manager.getRepository(NotificationPreference).find({
      where: { tenantMemberId: In(memberIds) },
      select: [
        'id',
        'tenantMemberId',
        'notificationType',
        'preferredChannel',
        'isEnabled',
        'emailEnabled',
        'inAppEnabled',
        'quietHoursStart',
        'quietHoursEnd',
        'quietDays',
      ],
    }),
    manager.getRepository(Notification).find({
      where: { recipientId: In(memberIds) },
      select: [
        'id',
        'tenantId',
        'recipientId',
        'type',
        'channel',
        'priority',
        'status',
        'title',
        'message',
        'sentAt',
        'deliveredAt',
        'readAt',
        'expiresAt',
      ],
    }),
  ]);

  return {
    memberships: members.map((m) => mapMembership(m, decryptOptional)),
    employment: employments.map(mapEmployment),
    documents: documents.map(mapDocument),
    leaves: leaves.map(mapLeave),
    attendance: attendances.map(mapAttendance),
    education: educations.map(mapEducation),
    emergencyContacts: emergencyContacts.map(mapEmergencyContact),
    addresses: addresses.map(mapAddress),
    payrollItems: payrollItems.map(mapPayrollItem),
    paymentMethods: paymentMethods.map((r) => mapPaymentMethod(r, decryptOptional)),
    notificationPreferences: notificationPreferences.map(mapNotificationPreference),
    notifications: notifications.map(mapNotification),
  };
}
