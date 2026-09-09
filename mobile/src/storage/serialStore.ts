/** All read/modify/write operations sharing a key must use the same executor.
 * A rejected write is returned to its caller without poisoning later writes. */
export class SerialExecutor {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.catch(() => undefined);
    return result;
  }

  async settled(): Promise<void> { await this.tail; }
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createDurableWriter(storage: KeyValueStore) {
  const writes = new SerialExecutor();
  return {
    save(key: string, value: unknown): Promise<void> {
      // Capture the value at invocation, not after an earlier asynchronous write.
      const serialized = JSON.stringify(value);
      return writes.run(() => storage.setItem(key, serialized));
    },
    settled: () => writes.settled()
  };
}
