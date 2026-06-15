import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AssetAssignmentStatus } from 'src/common/enums';
import { Repository } from 'typeorm';
import { AssetAssignment } from './entities/asset-assignment.entity';

@Injectable()
export class AssetAssignmentRepository extends Repository<AssetAssignment> {
  constructor(
    @InjectRepository(AssetAssignment)
    private readonly assignmentRepository: Repository<AssetAssignment>,
  ) {
    super(
      assignmentRepository.target,
      assignmentRepository.manager,
      assignmentRepository.queryRunner,
    );
  }
  async findActiveAssignmentByAsset(assetId: string): Promise<AssetAssignment | null> {
    return this.assignmentRepository.findOne({
      where: {
        assetId,
        status: AssetAssignmentStatus.ACTIVE,
      },
      relations: ['assignedTo', 'assignedBy'],
    });
  }
  async findAssignmentsByMember(
    tenantId: string,
    memberId: string,
    status?: string,
  ): Promise<AssetAssignment[]> {
    const whereConditions: Record<string, unknown> = {
      assignedToId: memberId,
      asset: { tenantId },
    };
    if (status) {
      whereConditions.status = status;
    }
    return this.assignmentRepository.find({
      where: whereConditions,
      relations: ['asset', 'asset.category', 'assignedBy'],
      order: { assignedDate: 'DESC' },
    });
  }
  async findOverdueAssignments(tenantId: string): Promise<AssetAssignment[]> {
    const currentDate = new Date();
    return this.assignmentRepository
      .find({
        where: {
          status: AssetAssignmentStatus.ACTIVE,
          asset: { tenantId },
        },
        relations: ['asset', 'assignedTo'],
      })
      .then((assignments) =>
        assignments.filter(
          (assignment) =>
            assignment.expectedReturnDate && assignment.expectedReturnDate < currentDate,
        ),
      );
  }
}
