/**
 * Counting semaphore used as a bulkhead around an outbound dependency: callers beyond the
 * in-flight budget wait, and callers beyond the wait budget are rejected instead of piling up.
 */
export class SemaphoreRejectedError extends Error {
  constructor(readonly resourceName: string) {
    super(`${resourceName} request queue is full`);
    this.name = 'SemaphoreRejectedError';
  }
}

export class Semaphore {
  private available: number;
  private queued = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    permits: number,
    private readonly maxQueued: number = Math.max(1, permits) * 4,
    private readonly resourceName = 'dependency',
  ) {
    this.available = Math.max(1, permits);
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    if (this.queued >= this.maxQueued) {
      return Promise.reject(new SemaphoreRejectedError(this.resourceName));
    }
    this.queued += 1;
    return new Promise<void>((resolve) => {
      this.waiters.push(() => {
        this.queued -= 1;
        resolve();
      });
    });
  }

  /** Handing the permit straight to a waiter keeps the count from admitting one caller too many. */
  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.available += 1;
  }
}
