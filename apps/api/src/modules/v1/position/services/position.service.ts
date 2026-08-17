import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { CreatePositionDto } from '../dto/create-position.dto';
import type { UpdatePositionDto } from '../dto/update-position.dto';
import type { Position } from '../entities/position.entity';
import { PositionRepository } from '../repositories/position.repository';

@Injectable()
export class PositionService {
  constructor(
    private readonly positionRepository: PositionRepository,
    private readonly activitiesService: ActivitiesService,
  ) {}
  async createPosition(
    tenantId: string,
    createPositionDto: CreatePositionDto,
    actorMemberId?: string,
  ): Promise<Position> {
    const position = this.positionRepository.create({
      ...createPositionDto,
      tenantId,
    });
    const saved = await this.positionRepository.save(position);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'position.created',
          resourceType: 'position',
          resourceId: saved.id,
          description: `Position "${createPositionDto.title}" created`,
          metadata: { title: createPositionDto.title },
        })
        .catch(() => {});
    }

    return saved;
  }
  async listPositions(tenantId: string): Promise<Position[]> {
    return this.positionRepository.listPositions(tenantId);
  }
  async getPosition(id: string, tenantId: string): Promise<Position> {
    const position = await this.positionRepository.getPosition(id, tenantId);
    if (!position) {
      throw new NotFoundException(`Position with ID "${id}" not found`);
    }
    return position;
  }
  async updatePosition(
    id: string,
    updatePositionDto: UpdatePositionDto,
    tenantId: string,
    actorMemberId?: string,
  ): Promise<Position> {
    await this.getPosition(id, tenantId);
    const updated = await this.positionRepository.updatePosition(id, updatePositionDto, tenantId);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'position.updated',
          resourceType: 'position',
          resourceId: id,
          description: `Position updated`,
          metadata: { updatedFields: Object.keys(updatePositionDto) },
        })
        .catch(() => {});
    }

    return updated;
  }
  async deletePosition(id: string, tenantId: string, actorMemberId?: string): Promise<void> {
    await this.getPosition(id, tenantId);
    await this.positionRepository.softDelete(id);

    if (actorMemberId) {
      void this.activitiesService
        .queueActivity({
          tenantId,
          actorMemberId,
          action: 'position.deleted',
          resourceType: 'position',
          resourceId: id,
          description: `Position deleted`,
        })
        .catch(() => {});
    }
  }
  async restorePosition(id: string, tenantId: string): Promise<Position> {
    await this.positionRepository.restorePosition(id, tenantId);
    return this.getPosition(id, tenantId);
  }
}
