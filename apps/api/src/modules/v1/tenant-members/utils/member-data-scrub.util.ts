import { PaymentMethodStatus } from 'src/common/enums/payment-method-status.enum';
import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { Address } from '../../address/entities/address.entity';
import { Attendance } from '../../attendance/entities/attendance.entity';
import { Document } from '../../document/entities/document.entity';
import { Education } from '../../education/entities/education.entity';
import { EmergencyContact } from '../../emergency-contact/entities/emergency-contact.entity';
import { Employment } from '../../employment/entities/employment.entity';
import { Leave } from '../../leave/entities/leave.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { PaymentMethod } from '../../payment-method/entities/payment-method.entity';
import { TenantMember } from '../entities/tenant-member.entity';

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
