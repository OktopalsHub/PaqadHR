import type { Logger } from '@nestjs/common';

type CronResult = Record<string, unknown> | undefined;

function isResultEmpty(result: CronResult): boolean {
  if (!result) return true;
  return Object.values(result).every((v) => v === 0);
}

export async function runCronJob(
  logger: Logger,
  jobName: string,
  job: () => Promise<CronResult>,
  options?: { silentWhenIdle?: boolean },
): Promise<void> {
  const startedAt = Date.now();

  try {
    const result = await job();
    const durationMs = Date.now() - startedAt;
    const idle = isResultEmpty(result);

    if (idle && options?.silentWhenIdle) {
      return;
    }

    const summary = result ? ` ${JSON.stringify(result)}` : '';
    logger.log(`[cron:done] ${jobName} durationMs=${durationMs}${summary}`);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[cron:error] ${jobName} durationMs=${durationMs} ${message}`);
    throw error;
  }
}
