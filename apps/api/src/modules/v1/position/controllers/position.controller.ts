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
import { TenantMemberGuard } from '../../tenant-members/guards/tenant-members.guards';
import type { CreatePositionDto } from '../dto/create-position.dto';
import type { UpdatePositionDto } from '../dto/update-position.dto';
import type { Position } from '../entities/position.entity';
import { PositionService } from '../services/position.service';

@ApiTags('Positions')
@UseGuards(TenantMemberGuard)
@Controller('tenants/:tenantId/positions')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}
  @Post()
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
  async updatePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionService.updatePosition(id, updatePositionDto, tenantId);
  }
  @Delete(':id')
  async deletePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.positionService.deletePosition(id, tenantId);
    return { message: 'Position deleted successfully' };
  }
  @Post(':id/restore')
  async restorePosition(
    @Param('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.positionService.restorePosition(id, tenantId);
  }
}
