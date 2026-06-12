import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from "../entities/position.entity";

@Injectable()
export class PositionRepository extends Repository<Position> {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {
    super(positionRepository.target, positionRepository.manager, positionRepository.queryRunner);
  }
  async listPositions(tenantId: string): Promise<Position[]> {
    return this.positionRepository.find({
      where: { tenantId },
    });
  }
  async getPosition(
    id: string,
    tenantId: string,
  ): Promise<Position | null> {
    return this.positionRepository.findOne({
      where: { id, tenantId },
    });
  }
  async softDeletePosition(id: string, tenantId: string): Promise<void> {
    const result = await this.positionRepository.softDelete({ id, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(`Position with ID "${id}" not found`);
    }
  }
  async updatePosition(
    id: string,
    updatePositionDto: Partial<Position>,
    tenantId: string,
  ): Promise<Position> {
    await this.positionRepository.update(
      { id, tenantId },
      updatePositionDto as Parameters<typeof this.positionRepository.update>[1],
    );
    const updatedPosition = await this.getPosition(id, tenantId);
    if (!updatedPosition) {
      throw new NotFoundException(
        `Position with ID "${id}" not found after update`,
      );
    }
    return updatedPosition;
  }
  async deletePosition(id: string, tenantId: string): Promise<void> {
    const result = await this.positionRepository.delete({ id, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(`Position with ID "${id}" not found`);
    }
  }
  async restorePosition(id: string, tenantId: string): Promise<void> {
    const result = await this.positionRepository.restore({ id, tenantId });
    if (result.affected === 0) {
      throw new NotFoundException(
        `Position with ID "${id}" not found or could not be restored`,
      );
    }
  }
}
