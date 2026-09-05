import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import type { DataSource, EntityManager } from 'typeorm';
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

/** Pure data helpers — keep UsersModule free of TenantMembersModule imports. */

export async function scrubMemberPersonalData(
  manager: EntityManager,
  userId: string,
): Promise<{ membershipCount: number; fileKeys: string[] }> {
  const memberRepo = manager.getRepository(TenantMember);
  const members = await memberRepo.find({
    where: { userId },
    select: ['id', 'avatarKey'],
  });
  const memberIds = members.map((member) => member.id);
  const fileKeys: string[] = [];

  for (const member of members) {
    if (member.avatarKey) {
      fileKeys.push(member.avatarKey);
    }
  }

  if (memberIds.length === 0) {
    return { membershipCount: 0, fileKeys };
  }

  const documentRepo = manager.getRepository(Document);
  const memberDocuments = await documentRepo.find({
    where: { tenantMemberId: In(memberIds) },
    select: ['id', 'fileKey'],
  });
  for (const document of memberDocuments) {
    if (document.fileKey) {
      fileKeys.push(document.fileKey);
    }
  }

  await manager
    .getRepository(PaymentMethod)
    .createQueryBuilder()
    .update(PaymentMethod)
    .set({
      accountNumber: null,
      accountName: null,
      bankCode: null,
      bankName: null,
      passcodeHash: null,
      status: PaymentMethodStatus.SUSPENDED,
      isPrimary: false,
    })
    .where('member_id IN (:...memberIds)', { memberIds })
    .execute();

  await Promise.all([
    manager.getRepository(EmergencyContact).delete({ tenantMemberId: In(memberIds) }),
    manager.getRepository(Address).delete({ tenantMemberId: In(memberIds) }),
    manager.getRepository(Education).delete({ tenantMemberId: In(memberIds) }),
    manager
      .getRepository(Leave)
      .update({ requestedBy: In(memberIds) }, { reason: '', comments: '' }),
    manager.getRepository(Attendance).update({ tenantMemberId: In(memberIds) }, { notes: '' }),
    manager.getRepository(Employment).update({ tenantMemberId: In(memberIds) }, { comments: '' }),
    manager.getRepository(Notification).delete({ recipientId: In(memberIds) }),
    documentRepo.delete({ tenantMemberId: In(memberIds) }),
    memberRepo.update(
      { userId },
      {
        firstName: null,
        lastName: null,
        middleName: null,
        preferredName: null,
        phone: null,
        dateOfBirth: null,
        gender: null,
        identityBvn: null,
        identityNin: null,
        avatarKey: null,
        isActive: false,
        leaveDate: new Date(),
      },
    ),
  ]);
  await memberRepo.softDelete({ userId });

  return { membershipCount: members.length, fileKeys };
}

export async function loadMemberPersonalDataForExport(
  dataSource: DataSource,
  userId: string,
  decryptOptional: (value?: string | null) => string | null,
): Promise<Record<string, unknown>> {
  const manager = dataSource.manager;
  const members = await manager.getRepository(TenantMember).find({
    where: { userId },
    relations: ['tenant'],
  });
  const memberIds = members.map((member) => member.id);

  if (memberIds.length === 0) {
    return {
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
  }

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
    memberships: members.map((member) => ({
      id: member.id,
      tenantId: member.tenantId,
      tenantName: member.tenant?.name,
      role: member.role,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      dateOfBirth: member.dateOfBirth,
      gender: member.gender,
      identityBvn: decryptOptional(member.identityBvn),
      identityNin: decryptOptional(member.identityNin),
      joinDate: member.joinDate,
      leaveDate: member.leaveDate,
      isActive: member.isActive,
    })),
    employment: employments.map((row) => ({
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
    })),
    documents: documents.map((row) => ({
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
    })),
    leaves: leaves.map((row) => ({
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
    })),
    attendance: attendances.map((row) => ({
      id: row.id,
      tenantMemberId: row.tenantMemberId,
      tenantId: row.tenantId,
      date: row.date,
      clockIn: row.clockIn,
      clockOut: row.clockOut,
      workHours: row.workHours,
      status: row.status,
      notes: row.notes,
    })),
    education: educations.map((row) => ({
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
    })),
    emergencyContacts: emergencyContacts.map((row) => ({
      id: row.id,
      tenantMemberId: row.tenantMemberId,
      tenantId: row.tenantId,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      email: row.email,
      relationship: row.relationship,
      address: row.address,
      isPrimary: row.isPrimary,
    })),
    addresses: addresses.map((row) => ({
      id: row.id,
      tenantMemberId: row.tenantMemberId,
      country: row.country,
      city: row.city,
      state: row.state,
      street: row.street,
      postalCode: row.postalCode,
    })),
    payrollItems: payrollItems.map((row) => ({
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
    })),
    paymentMethods: paymentMethods.map((row) => ({
      id: row.id,
      memberId: row.memberId,
      tenantId: row.tenantId,
      type: row.type,
      currency: row.currency,
      bankName: row.bankName,
      bankCode: row.bankCode,
      accountName: decryptOptional(row.accountName),
      accountNumber: decryptOptional(row.accountNumber),
      country: row.country,
      isPrimary: row.isPrimary,
      status: row.status,
      displayName: row.displayName,
    })),
    notificationPreferences: notificationPreferences.map((row) => ({
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
    })),
    notifications: notifications.map((row) => ({
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
    })),
  };
}
