/**
 * Attaches `<slug>.<hostSuffix>` to the web Worker as a Cloudflare custom domain for
 * every workspace that does not have one yet. Run it once after enabling tenant
 * subdomains, or any time a workspace's subdomain is missing.
 *
 * Requires the same DATABASE_URL + CF_WORKER_DOMAIN_* variables as the API:
 *   - local:    pnpm --filter api provision:tenant-domains
 *   - deployed: pnpm --filter api provision:tenant-domains:dist   (only dist is shipped)
 * Add --dry-run to report what would change without calling Cloudflare.
 */
import { Logger } from '@nestjs/common';
import { resolveWorkerDomainConfig } from '../common/config/worker-domain.config';
import dataSource from '../common/database/config/data-source';
import { WorkerDomainService } from '../common/services/worker-domain.service';
import { Tenant } from '../modules/v1/tenants/entities/tenant.entity';

const logger = new Logger('ProvisionTenantDomains');

async function provision(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const config = resolveWorkerDomainConfig();
  if (!config.enabled) {
    logger.error(
      'Cloudflare Worker domains are not configured — set CF_WORKER_DOMAIN_API_TOKEN, CF_WORKER_DOMAIN_ZONE_ID and CF_WORKER_DOMAIN_WORKER_NAME.',
    );
    process.exitCode = 1;
    return;
  }
  logger.log(
    `Worker=${config.workerName} suffix=${config.hostSuffix} account=${config.accountId} dryRun=${dryRun}`,
  );

  dataSource.setOptions({ migrationsRun: false });
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const service = new WorkerDomainService();
  const attached = await service.listHostnames();
  if (!attached) {
    logger.error('Could not read the current custom domains from Cloudflare — nothing changed.');
    process.exitCode = 1;
    return;
  }

  const alreadyAttached = new Set(attached);
  const tenants = await dataSource.getRepository(Tenant).find({
    select: ['id', 'slug'],
    order: { createdAt: 'ASC' },
  });

  const summary = { attached: 0, present: 0, failed: 0, skipped: 0 };
  for (const tenant of tenants) {
    const hostname = service.hostnameFor(tenant.slug);
    if (!hostname) {
      logger.warn(`Skipping ${tenant.slug} — not a valid hostname`);
      summary.skipped += 1;
      continue;
    }
    if (alreadyAttached.has(hostname)) {
      summary.present += 1;
      continue;
    }
    if (dryRun) {
      logger.log(`Would attach ${hostname}`);
      summary.attached += 1;
      continue;
    }

    const outcome = await service.ensure(tenant.slug);
    if (outcome === 'created') {
      summary.attached += 1;
    } else if (outcome === 'present') {
      summary.present += 1;
    } else {
      summary.failed += 1;
      logger.warn(`Could not attach ${hostname}: ${outcome}`);
    }
  }

  const verb = dryRun ? 'would be attached' : 'attached';
  logger.log(
    `Done. ${summary.attached} ${verb}, ${summary.present} already present, ${summary.failed} failed, ${summary.skipped} skipped.`,
  );
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

provision()
  .then(() => {
    void dataSource.destroy();
  })
  .catch((error: Error) => {
    logger.error(error.message, error.stack);
    void dataSource.destroy();
    process.exit(1);
  });
