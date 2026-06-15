import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreatePositionDto } from '../dto/create-position.dto';
import type { UpdatePositionDto } from '../dto/update-position.dto';
import type { Position } from '../entities/position.entity';
import type { PositionRepository } from '../repositories/position.repository';

@Injectable()
export class PositionService {
  constructor(private readonly positionRepository: PositionRepository) {}
  async createPosition(tenantId: string, createPositionDto: CreatePositionDto): Promise<Position> {
    const position = this.positionRepository.create({
      ...createPositionDto,
      tenantId,
    });
    return this.positionRepository.save(position);
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
  ): Promise<Position> {
    await this.getPosition(id, tenantId);
    return this.positionRepository.updatePosition(id, updatePositionDto, tenantId);
  }
  async deletePosition(id: string, tenantId: string): Promise<void> {
    await this.getPosition(id, tenantId);
    await this.positionRepository.softDelete(id);
  }
  async restorePosition(id: string, tenantId: string): Promise<Position> {
    await this.positionRepository.restorePosition(id, tenantId);
    return this.getPosition(id, tenantId);
  }
}
