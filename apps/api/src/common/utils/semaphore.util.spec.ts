import { Semaphore, SemaphoreRejectedError } from './semaphore.util';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('Semaphore', () => {
  it('never admits more tasks than its permits', async () => {
    const gate = new Semaphore(3);
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 10 }, () =>
        gate.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(3);
  });

  it('rejects callers once the wait queue is full, and admits them again after a release', async () => {
    const gate = new Semaphore(1, 1);
    const hold = deferred();
    const running = gate.run(() => hold.promise);
    const queued = gate.run(async () => 'queued');

    await expect(gate.run(async () => 'rejected')).rejects.toBeInstanceOf(SemaphoreRejectedError);

    hold.resolve();
    await expect(running).resolves.toBeUndefined();
    await expect(queued).resolves.toBe('queued');
  });

  it('releases the permit when the task throws', async () => {
    const gate = new Semaphore(1);

    await expect(
      gate.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(gate.run(async () => 'second')).resolves.toBe('second');
  });
});
