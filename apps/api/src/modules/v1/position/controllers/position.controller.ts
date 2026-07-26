import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeatures } from 'src/common/decorators';
import { TenantMemberRole } from 'src/common/enums';
import { FeatureAccess } from 'src/common/enums/subscription.enum';
import { Roles, TenantRoleGuard } from 'src/common/guards/tenant-member-role.guard';
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import { CreatePositionDto } from '../dto/create-position.dto';
import { UpdatePositionDto } from '../dto/update-position.dto';
import type { Position } from '../entities/position.entity';
import { PositionService } from '../services/position.service';

@ApiTags('Positions')
@Controller('tenants/:tenantId/positions')
@UseGuards(TenantMemberGuard)
@RequireFeatures(FeatureAccess.BASIC_HR)
export class PositionController {
  constructor(private readonly positionService: PositionService) {}
  @Post()
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async createPosition(
    @Param('tenantId') tenantId: string,
    @Body() createPositionDto: CreatePositionDto,
  ): Promise<Position> {
    return this.positionService.createPosition(tenantId, createPositionDto);
  }
  @Get()
  async listPositions(@Param('tenantId') tenantId: string) {
    return this.positionService.listPositions(tenantId);
  }
  @Get(':id')
  async getPosition(@Param('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.positionService.getPosition(id, tenantId);
  }
  @Patch(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async updatePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionService.updatePosition(id, updatePositionDto, tenantId);
  }
  @Delete(':id')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async deletePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.positionService.deletePosition(id, tenantId);
    return { message: 'Position deleted successfully' };
  }
  @Post(':id/restore')
  @UseGuards(TenantRoleGuard)
  @Roles(TenantMemberRole.OWNER, TenantMemberRole.ADMIN)
  async restorePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.positionService.restorePosition(id, tenantId);
  }
}
