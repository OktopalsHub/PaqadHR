import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthOnly, RateLimit, RateLimitPresets } from 'src/common/decorators';
import { UserRole } from 'src/common/enums';
import { RoleGuard, Roles } from 'src/common/guards/role.guard';
import type { IAuthenticatedUserRequest } from 'src/common/interfaces';
import { PayrollRunRepository } from '../repositories/payroll-run.repository';
import { PayrollService } from '../services/payroll.service';
import { PayrollRunFundingLedgerService } from '../services/payroll-run-funding-ledger.service';

const MAX_SUPPORT_LIST_LIMIT = 100;

/**
 * Platform-side view of retry funding that is still open.
 *
 * A tenant that abandoned a retry checkout can be wedged behind it, and the tenant panel has
 * no admin surface of its own. This gives support a way to find the run and release it for the
 * tenant, without waiting for the pending window to expire.
 */
@ApiTags('Payroll Admin')
@Controller('admin/payroll')
@AuthOnly()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class PayrollAdminController {
  private readonly logger = new Logger(PayrollAdminController.name);

  constructor(
    private readonly payrollService: PayrollService,
    private readonly payrollRunRepository: PayrollRunRepository,
    private readonly payrollRunFundingLedger: PayrollRunFundingLedgerService,
  ) {}

  @Get('pending-retry-funding')
  @ApiOperation({
    summary: 'List payroll runs with an open retry funding approval or checkout',
  })
  async listPendingRetryFunding(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), MAX_SUPPORT_LIST_LIMIT)
        : 25;

    const runs = await this.payrollRunRepository.findRunsWithOpenRetryFunding(safeLimit);
    return {
      count: runs.length,
      runs: runs.map((run) => {
        const retryFunding = (run.metadata?.retryFunding ?? {}) as Record<string, unknown>;
        return {
          payrollRunId: run.id,
          tenantId: run.tenantId,
          title: run.title,
          runStatus: run.status,
          orderReference:
            typeof retryFunding.orderReference === 'string'
              ? retryFunding.orderReference
              : undefined,
          fundingStatus: typeof retryFunding.status === 'string' ? retryFunding.status : undefined,
          amount: typeof retryFunding.amount === 'number' ? retryFunding.amount : undefined,
          checkoutAmount:
            typeof retryFunding.checkoutAmount === 'number'
              ? retryFunding.checkoutAmount
              : undefined,
          currency: typeof retryFunding.currency === 'string' ? retryFunding.currency : undefined,
          approvedAt:
            typeof retryFunding.approvedAt === 'string' ? retryFunding.approvedAt : undefined,
          checkoutRequestedAt:
            typeof retryFunding.checkoutRequestedAt === 'string'
              ? retryFunding.checkoutRequestedAt
              : undefined,
          updatedAt: run.updatedAt,
        };
      }),
    };
  }

  @Get('tenant/:tenantId/runs/:id/retry-funding')
  @ApiOperation({ summary: 'Inspect one payroll run retry funding state and ledger' })
  async getRetryFunding(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    const run = await this.payrollRunRepository.findOne({
      where: { id, tenantId },
      select: { id: true, tenantId: true, title: true, status: true, metadata: true },
    });
    if (!run) {
      throw new BadRequestException('Payroll run not found for this tenant');
    }
    const ledger = await this.payrollRunFundingLedger.getRunLedger(tenantId, id);
    return {
      payrollRunId: run.id,
      tenantId: run.tenantId,
      title: run.title,
      runStatus: run.status,
      retryFunding: run.metadata?.retryFunding ?? null,
      ledgerEntries: ledger.entries.map((entry) => ({
        eventType: entry.eventType,
        amount: entry.amount,
        currency: entry.currency,
        provider: entry.provider,
        providerReference: entry.providerReference,
        createdAt: entry.createdAt,
        performedById: entry.performedById,
        approvedById: entry.approvedById,
        evidence: entry.evidence,
      })),
    };
  }

  @Post('tenant/:tenantId/runs/:id/retry-funding/cancel')
  @RateLimit(RateLimitPresets.SENSITIVE)
  @ApiOperation({
    summary: 'Cancel an open retry funding approval or checkout on behalf of a tenant',
  })
  async cancelRetryFunding(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Req() req: IAuthenticatedUserRequest,
  ) {
    const result = await this.payrollService.cancelRetryFunding(
      id,
      tenantId,
      req.auth.principalId,
      {
        reason: 'cancelled_by_support',
      },
    );
    this.logger.log(
      `Support cancelled retry funding for payroll run ${id} (tenant ${tenantId}): ${result.status}`,
    );
    return result;
  }
}
