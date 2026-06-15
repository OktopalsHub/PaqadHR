import type { Position } from '../../modules/v1/position/entities/position.entity';

export interface IPositionRepository {
  createPosition(createPositionDto: Partial<Position>): Promise<Position>;
  listPositions(tenantId: string): Promise<Position[]>;
  getPosition(id: string, tenantId: string): Promise<Position | null>;
  updatePosition(
    id: string,
    updatePositionDto: Partial<Position>,
    tenantId: string,
  ): Promise<Position>;
  deletePosition(id: string, tenantId: string): Promise<void>;
  softDeletePosition(id: string, tenantId: string): Promise<void>;
  restorePosition(id: string, tenantId: string): Promise<void>;
}
