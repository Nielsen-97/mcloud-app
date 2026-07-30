export interface QueueItem<T> {
  id: string;
  data: T;
}

export interface RunQueueOptions<T> {
  items: QueueItem<T>[];
  concurrency?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  run: (item: T, onItemProgress: (fraction: number) => void) => Promise<void>;
  onItemDone?: (id: string) => void | Promise<void>;
  onItemFailed?: (id: string, error: unknown) => void;
  onOverallProgress?: (done: number, total: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Runs items with bounded concurrency and per-item retry with exponential backoff. */
export async function runQueue<T>(options: RunQueueOptions<T>): Promise<void> {
  const {
    items,
    concurrency = 2,
    maxAttempts = 4,
    baseDelayMs = 1000,
    run,
    onItemDone,
    onItemFailed,
    onOverallProgress,
  } = options;

  let cursor = 0;
  let completed = 0;
  const total = items.length;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;

      let lastError: unknown;
      let succeeded = false;
      for (let attempt = 1; attempt <= maxAttempts && !succeeded; attempt += 1) {
        try {
          await run(item.data, () => {});
          succeeded = true;
        } catch (error) {
          lastError = error;
          if (attempt < maxAttempts) {
            await delay(baseDelayMs * 2 ** (attempt - 1));
          }
        }
      }

      completed += 1;
      if (succeeded) {
        await onItemDone?.(item.id);
      } else {
        onItemFailed?.(item.id, lastError);
      }
      onOverallProgress?.(completed, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
}
