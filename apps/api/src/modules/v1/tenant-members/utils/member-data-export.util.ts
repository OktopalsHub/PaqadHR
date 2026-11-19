import type { DataSource } from 'typeorm';
import { In } from 'typeorm';

import { Address } from '../../address/entities/address.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { Document } from '../../document/entities/document.entity';
import { Education } from '../../education/entities/education.entity';
import { EmergencyContact } from '../../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { Leave } from '../../leave/entities/leave.entity';
import { NotificationPreference } from '../../notifications/entities/notification-preference.entity';
import { Notification } from '../../notifications/entities/notification.entity';
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
    relations: { tenant: true },
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
      select: {
        id: true,
        tenantMemberId: true,
        tenantId: true,
        startDate: true,
        endDate: true,
        status: true,
        payType: true,
        paySchedule: true,
        payRate: true,
        currency: true,
        comments: true,
      },
    }),
    manager.getRepository(Document).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        tenantId: true,
        name: true,
        type: true,
        fileKey: true,
        issueDate: true,
        expiryDate: true,
        description: true,
        isVerified: true,
      },
    }),
    manager.getRepository(Leave).find({
      where: { requestedBy: In(memberIds) },
      select: {
        id: true,
        tenantId: true,
        requestedBy: true,
        leaveTypeId: true,
        startDate: true,
        endDate: true,
        duration: true,
        status: true,
        reason: true,
        comments: true,
      },
    }),
    manager.getRepository(Attendance).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        tenantId: true,
        date: true,
        clockIn: true,
        clockOut: true,
        workHours: true,
        status: true,
        notes: true,
      },
    }),
    manager.getRepository(Education).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        tenantId: true,
        title: true,
        degreeType: true,
        institution: true,
        fieldOfStudy: true,
        startDate: true,
        endDate: true,
        description: true,
        gpa: true,
      },
    }),
    manager.getRepository(EmergencyContact).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        tenantId: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        relationship: true,
        address: true,
        isPrimary: true,
      },
    }),
    manager.getRepository(Address).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        country: true,
        city: true,
        state: true,
        street: true,
        postalCode: true,
      },
    }),
    manager.getRepository(PayrollItem).find({
      where: { memberId: In(memberIds) },
      select: {
        id: true,
        memberId: true,
        payrollRunId: true,
        status: true,
        baseSalary: true,
        baseSalaryCurrency: true,
        grossAmount: true,
        adjustments: true,
        deductions: true,
        netAmount: true,
        paymentCurrency: true,
        paymentAmount: true,
        exchangeRate: true,
        paidAt: true,
        description: true,
      },
    }),
    manager.getRepository(PaymentMethod).find({
      where: { memberId: In(memberIds) },
      select: {
        id: true,
        memberId: true,
        tenantId: true,
        type: true,
        currency: true,
        bankName: true,
        bankCode: true,
        accountName: true,
        accountNumber: true,
        country: true,
        isPrimary: true,
        status: true,
        displayName: true,
      },
    }),
    manager.getRepository(NotificationPreference).find({
      where: { tenantMemberId: In(memberIds) },
      select: {
        id: true,
        tenantMemberId: true,
        notificationType: true,
        preferredChannel: true,
        isEnabled: true,
        emailEnabled: true,
        inAppEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        quietDays: true,
      },
    }),
    manager.getRepository(Notification).find({
      where: { recipientId: In(memberIds) },
      select: {
        id: true,
        tenantId: true,
        recipientId: true,
        type: true,
        channel: true,
        priority: true,
        status: true,
        title: true,
        message: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        expiresAt: true,
      },
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
