import { Injectable, NotFoundException } from '@nestjs/common';
import { PositionRepository } from "../repositories/position.repository";
import { CreatePositionDto } from "../dto/create-position.dto";
import { Position } from "../entities/position.entity";
import { UpdatePositionDto } from "../dto/update-position.dto";

@Injectable()
export class PositionService {
  constructor(private readonly positionRepository: PositionRepository) {}
  async createPosition(
    tenantId: string,
    createPositionDto: CreatePositionDto,
  ): Promise<Position> {
    return this.positionRepository.create({
      ...createPositionDto,
      tenantId,
    });
  }
  async listPositions(tenantId: string): Promise<Position[]> {
    return this.positionRepository.listPositions(tenantId);
  }
  async getPosition(id: string, tenantId: string): Promise<Position> {
    const position = await this.positionRepository.getPosition(
      id,
      tenantId,
    );
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
    return this.positionRepository.updatePosition(
      id,
      updatePositionDto,
      tenantId,
    );
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
