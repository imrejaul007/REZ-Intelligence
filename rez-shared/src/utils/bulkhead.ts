type Semaphore = {
  acquire: () => Promise<() => void>;
  tryAcquire: () => boolean;
};

export function createSemaphore(maxConcurrent: number): Semaphore {
  let current = 0;
  const waiting: Array<() => void> = [];

  return {
    async acquire(): Promise<() => void> {
      if (current < maxConcurrent) {
        current++;
        return () => {
          current--;
          const next = waiting.shift();
          if (next) next();
        };
      }

      return new Promise<void>(resolve => {
        waiting.push(() => {
          current++;
          resolve();
        });
      }).then(() => () => {
        current--;
        const next = waiting.shift();
        if (next) next();
      });
    },

    tryAcquire(): boolean {
      if (current < maxConcurrent) {
        current++;
        return true;
      }
      return false;
    }
  };
}

export class Bulkhead {
  private semaphores = new Map<string, Semaphore>();

  getSemaphore(name: string, maxConcurrent: number): Semaphore {
    if (!this.semaphores.has(name)) {
      this.semaphores.set(name, createSemaphore(maxConcurrent));
    }
    return this.semaphores.get(name)!;
  }

  async execute<T>(
    name: string,
    maxConcurrent: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const semaphore = this.getSemaphore(name, maxConcurrent);
    const release = await semaphore.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
