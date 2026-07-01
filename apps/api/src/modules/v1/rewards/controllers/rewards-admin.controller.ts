import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthOnly } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import { Repository } from 'typeorm';
import { MisdirectedDeposit } from '../entities/misdirected-deposit.entity';

@ApiTags('Rewards Admin')
@Controller('admin/misdirected-deposits')
@AuthOnly()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class RewardsAdminController {
  constructor(
    @InjectRepository(MisdirectedDeposit)
    private readonly misdirectedRepo: Repository<MisdirectedDeposit>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List misdirected wallet deposits (unknown VA)' })
  async list(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.misdirectedRepo.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }
}
