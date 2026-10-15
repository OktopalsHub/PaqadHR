import { PositionRepository } from '../repositories/position.repository';
import { PositionService } from './position.service';

describe('PositionService', () => {
  it('soft-deletes a position within the current tenant scope', async () => {
    const repository = {
      getPosition: jest.fn().mockResolvedValue({ id: 'position-1' }),
      softDeletePosition: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PositionService(
      repository as unknown as PositionRepository,
      { queueActivity: jest.fn() } as never,
    );

    await service.deletePosition('position-1', 'tenant-1');

    expect(repository.softDeletePosition).toHaveBeenCalledWith('position-1', 'tenant-1');
  });
});
