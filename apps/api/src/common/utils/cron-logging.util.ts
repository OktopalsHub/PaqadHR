import type { Logger } from '@nestjs/common';

export async function runCronJob(
  logger: Logger,
  jobName: string,
  job: () => Promise<Record<string, unknown> | undefined>,
): Promise<void> {
  const startedAt = Date.now();
  logger.log(`[cron:start] ${jobName}`);

  try {
    const result = await job();
    const durationMs = Date.now() - startedAt;
    const summary = result ? ` ${JSON.stringify(result)}` : '';
    logger.log(`[cron:done] ${jobName} durationMs=${durationMs}${summary}`);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[cron:error] ${jobName} durationMs=${durationMs} ${message}`);
    throw error;
  }
}
