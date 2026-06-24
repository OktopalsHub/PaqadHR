import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CelebrationType } from 'src/common/enums/celebration-type.enum';
import { TenantMemberRole } from 'src/common/enums';
import { Repository } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { TenantMembersService } from '../../tenant-members/tenant-members.service';
import { TenantSettingsService } from '../../tenant-settings/services/tenant-settings.service';
import { memberDisplayName, renderCelebrationTemplate } from '../utils/celebration-template.util';
import { ShoutoutsService } from './shoutouts.service';

@Injectable()
export class CelebrationShoutoutService {
  private readonly logger = new Logger(CelebrationShoutoutService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantMembersService: TenantMembersService,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly shoutoutsService: ShoutoutsService,
  ) {}

  async processDailyCelebrations(): Promise<{ birthdays: number; anniversaries: number }> {
    const tenants = await this.tenantRepository.find({
      where: { isActive: true },
      select: ['id', 'name'],
    });

    let birthdays = 0;
    let anniversaries = 0;

    for (const tenant of tenants) {
      try {
        const settings = await this.tenantSettingsService.getTenantSettings(tenant.id);
        const shoutoutSettings = settings.settings.shoutouts;
        const actorId = await this.resolveCelebrationActorId(tenant.id);
        if (!actorId) continue;

        const birthdayTemplate = shoutoutSettings.birthday;
        if (birthdayTemplate?.enabled && birthdayTemplate.points > 0) {
          const members = await this.tenantMembersService.findMembersWithBirthdayToday(tenant.id);
          for (const member of members) {
            const created = await this.shoutoutsService.createCelebrationShoutout({
              tenantId: tenant.id,
              actorMemberId: actorId,
              recipientId: member.id,
              points: birthdayTemplate.points,
              message: renderCelebrationTemplate(birthdayTemplate.messageTemplate, {
                name: memberDisplayName(member),
                company: tenant.name,
              }),
              celebrationType: CelebrationType.BIRTHDAY,
            });
            if (created) birthdays++;
          }
        }

        const anniversaryTemplate = shoutoutSettings.workAnniversary;
        if (anniversaryTemplate?.enabled && anniversaryTemplate.points > 0) {
          const members =
            await this.tenantMembersService.findMembersWithWorkAnniversaryToday(tenant.id);
          for (const { member, employmentStartDate } of members) {
            const years = this.calculateAnniversaryYears(employmentStartDate);
            if (years < 1) continue;

            const created = await this.shoutoutsService.createCelebrationShoutout({
              tenantId: tenant.id,
              actorMemberId: actorId,
              recipientId: member.id,
              points: anniversaryTemplate.points,
              message: renderCelebrationTemplate(anniversaryTemplate.messageTemplate, {
                name: memberDisplayName(member),
                years,
                company: tenant.name,
              }),
              celebrationType: CelebrationType.ANNIVERSARY,
            });
            if (created) anniversaries++;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Celebration shoutouts skipped for tenant ${tenant.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    return { birthdays, anniversaries };
  }

  private calculateAnniversaryYears(startDate: Date): number {
    const start = new Date(startDate);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    if (
      now.getMonth() < start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())
    ) {
      years -= 1;
    }
    return years;
  }

  private async resolveCelebrationActorId(tenantId: string): Promise<string | null> {
    const members = await this.tenantMembersService.listActiveTenantMembers(tenantId);
    const owner = members.find((member) => member.role === TenantMemberRole.OWNER);
    return owner?.id ?? members[0]?.id ?? null;
  }
}
