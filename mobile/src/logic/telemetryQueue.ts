import { KeyValueStore, SerialExecutor } from '../storage/serialStore';
import { utf8Bytes } from './bytes';

export interface TestTelemetryEvent { id: string; at: string; type: string; payload?: unknown }
export interface TelemetryQueueStatus { queued: number; dropped: number; truncated: number; lastError?: string; lastUploadAt?: string }
interface QueueState { version: 2; events: TestTelemetryEvent[]; dropped: number; truncated: number; lastError?: string; lastUploadAt?: string }
export const TELEMETRY_REQUEST_BYTES = 280_000;
const EVENT_BYTES = 240_000;
const QUEUE_BYTES = 1_500_000;
const MAX_EVENTS = 1_200;
const empty = (): QueueState => ({ version: 2, events: [], dropped: 0, truncated: 0 });

export function telemetryBatch(deviceId: string, events: TestTelemetryEvent[], maxEvents = 10): TestTelemetryEvent[] {
  const batch: TestTelemetryEvent[] = [];
  for (const event of events) {
    if (batch.length >= maxEvents || utf8Bytes(JSON.stringify({ deviceId, events: [...batch, event] })) > TELEMETRY_REQUEST_BYTES) break;
    batch.push(event);
  }
  return batch;
}

function boundEvent(event: TestTelemetryEvent): { event: TestTelemetryEvent; truncated: boolean } {
  try {
    const serialized = JSON.stringify(event);
    if (utf8Bytes(serialized) <= EVENT_BYTES) return { event: JSON.parse(serialized) as TestTelemetryEvent, truncated: false };
  } catch { /* An explicit marker makes unavailable payloads visible to the tester. */ }
  return { event: { id: event.id, at: event.at, type: event.type, payload: { truncated: true, reason: 'event_too_large_or_not_serializable' } }, truncated: true };
}

/** Acknowledge only sent IDs from the latest queue, not a pre-upload snapshot. */
export class TelemetryQueue {
  private readonly changes = new SerialExecutor();
  private inFlight: Promise<void> | null = null;
  private lastStorageError: string | undefined;
  constructor(private readonly storage: KeyValueStore, private readonly key: string, private readonly deviceId: () => Promise<string>, private readonly send: (deviceId: string, events: TestTelemetryEvent[]) => Promise<void>) {}

  private async read(): Promise<QueueState> {
    const raw = await this.storage.getItem(this.key);
    if (!raw) return empty();
    try {
      const parsed: unknown = JSON.parse(raw);
      const state = Array.isArray(parsed) ? { ...empty(), events: parsed } : parsed as QueueState;
      if (!state || !Array.isArray(state.events)) throw new Error('invalid_queue');
      let truncated = Number(state.truncated) || 0;
      const valid = state.events.filter((event) => event && typeof event.id === 'string' && typeof event.at === 'string' && typeof event.type === 'string').map((event) => { const result = boundEvent(event); if (result.truncated) truncated += 1; return result.event; });
      return { ...state, version: 2, events: valid, dropped: (Number(state.dropped) || 0) + state.events.length - valid.length, truncated };
    } catch {
      return { ...empty(), dropped: 1, lastError: 'The previous diagnostics queue was unreadable.' };
    }
  }

  private async write(state: QueueState): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(state));
    this.lastStorageError = undefined;
  }

  async enqueue(input: TestTelemetryEvent): Promise<void> {
    const bounded = boundEvent(input);
    try {
      await this.changes.run(async () => {
        const state = await this.read();
        state.events.push(bounded.event);
        if (bounded.truncated) state.truncated += 1;
        while (state.events.length > MAX_EVENTS || utf8Bytes(JSON.stringify(state)) > QUEUE_BYTES) {
          if (!state.events.shift()) break;
          state.dropped += 1;
        }
        await this.write(state);
      });
    } catch (error) {
      this.lastStorageError = error instanceof Error ? error.message : 'Unable to queue diagnostics on this phone.';
      throw error;
    }
  }

  async status(): Promise<TelemetryQueueStatus> {
    return this.changes.run(async () => {
      try {
        const state = await this.read();
        return { queued: state.events.length, dropped: state.dropped, truncated: state.truncated, lastError: this.lastStorageError || state.lastError, lastUploadAt: state.lastUploadAt };
      } catch (error) {
        return { queued: 0, dropped: 0, truncated: 0, lastError: this.lastStorageError || (error instanceof Error ? error.message : 'Unable to read diagnostics queue.') };
      }
    });
  }

  flush(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async drain(): Promise<void> {
    try {
      const deviceId = await this.deviceId();
      while (true) {
        const state = await this.changes.run(() => this.read());
        if (!state.events.length) return;
        const batch = telemetryBatch(deviceId, state.events);
        if (!batch.length) throw new Error('A diagnostics event is too large to send.');
        await this.send(deviceId, batch);
        const acknowledged = new Set(batch.map((event) => event.id));
        await this.changes.run(async () => {
          const current = await this.read();
          current.events = current.events.filter((event) => !acknowledged.has(event.id));
          current.lastError = undefined;
          current.lastUploadAt = new Date().toISOString();
          await this.write(current);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : 'Diagnostics upload failed; events retained for retry.';
      this.lastStorageError = message;
      try {
        await this.changes.run(async () => { const state = await this.read(); state.lastError = message; await this.write(state); });
      } catch { /* In-memory status still exposes the storage failure. */ }
    }
  }

  /** Wait for the active upload before deleting the old trail. */
  async reset(deleteRemote: (deviceId: string) => Promise<void>): Promise<void> {
    if (this.inFlight) await this.inFlight;
    await this.changes.run(async () => {
      await deleteRemote(await this.deviceId());
      await this.write(empty());
    });
  }
}
