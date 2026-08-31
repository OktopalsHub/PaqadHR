export type TabUrlUpdate<T extends string> = {
  tab: T;
  previousTab: T;
};

type QueueTask = (callback: () => void) => void;

/** Coalesces same-task tab changes so the URL reflects the most recent selection. */
export function createTabUrlUpdateScheduler<T extends string>(
  write: (update: TabUrlUpdate<T>) => void,
  queueTask: QueueTask = queueMicrotask,
): (tab: T, previousTab: T) => void {
  let isQueued = false;
  let latestUpdate: TabUrlUpdate<T> | null = null;

  return (tab, previousTab) => {
    latestUpdate = { tab, previousTab };
    if (isQueued) return;

    isQueued = true;
    queueTask(() => {
      const update = latestUpdate;
      latestUpdate = null;
      isQueued = false;
      if (update) write(update);
    });
  };
}
