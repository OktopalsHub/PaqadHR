import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvitationStatus } from 'src/common/enums';
import { Repository } from 'typeorm';
import { Invitation } from '../entities/invitation.entity';

@Injectable()
export class InvitationsRepository extends Repository<Invitation> {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
  ) {
    super(invitationRepository.target, invitationRepository.manager, invitationRepository.queryRunner);
  }

  async listInvitations(status?: string): Promise<Invitation[]> {
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status as InvitationStatus;
    }
    return this.find({ withDeleted: false, where: where, relations: ['department', 'position'] });
  }

  async findInvitation(id: string): Promise<Invitation | null> {
    return this.findOne({
      where: { id },
      relations: ['department', 'position'],
    });
  }

  async findInvitationByTenant(
    id: string,
    tenantId: string,
  ): Promise<Invitation | null> {
    return this.findOne({
      where: { id, tenantId },
      relations: ['department', 'position'],
    });
  }

  async findInvitationByEmail(email: string): Promise<Invitation[]> {
    return this.find({ withDeleted: false, where: { email }, relations: ['department', 'position'] });
  }

  async findInvitationByToken(token: string): Promise<Invitation | null> {
    return this.findOne({
      where: { token },
      relations: ['department', 'position'],
    });
  }

  async listInvitationsByTenant(tenantId: string): Promise<Invitation[]> {
    return this.find({ withDeleted: false, where: { tenantId }, relations: ['department', 'position'] });
  }

  async findPendingInvitationByEmail(email: string): Promise<Invitation[]> {
    return this.find({ withDeleted: false, where: {
              email,
              status: InvitationStatus.PENDING,
            } });
  }

  async updateInvitation(
    id: string,
    updateData: Partial<Invitation>,
  ): Promise<Invitation> {
    const result = await this.update(
      id,
      updateData as Parameters<Repository<Invitation>['update']>[1],
    );
    if (!result.affected) {
      throw new NotFoundException(`Invitation with id ${id} not found`);
    }
    const updated = await this.findInvitation(id);
    if (!updated) {
      throw new NotFoundException(`Invitation with id ${id} not found`);
    }
    return updated;
  }

  async acceptInvitation(id: string): Promise<Invitation> {
    return this.updateInvitation(id, { status: InvitationStatus.ACCEPTED });
  }

  async declineInvitation(id: string): Promise<Invitation> {
    return this.updateInvitation(id, { status: InvitationStatus.DECLINED });
  }

  async expireInvitations(): Promise<void> {
    await this.invitationRepository
      .createQueryBuilder()
      .update(Invitation)
      .set({ status: InvitationStatus.EXPIRED })
      .where('expiresAt < :now', { now: new Date() })
      .andWhere('status = :status', { status: InvitationStatus.PENDING })
      .execute();
  }
}
