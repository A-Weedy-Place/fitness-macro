import AsyncStorage from '@react-native-async-storage/async-storage';
import { postTestTelemetry, resetTestTelemetry } from '../services/agentClient';

const DEVICE_KEY = 'weed-fitness-test-device-v1';
const QUEUE_KEY = 'weed-fitness-test-telemetry-queue-v1';
const MAX_QUEUED_EVENTS = 160;
const MAX_EVENT_BYTES = 250_000;
// The Worker accepts up to 12 events. Batching keeps detailed preview logging
// from consuming the separate telemetry request allowance one tap at a time.
const BATCH_SIZE = 10;
const TEST_TELEMETRY_ENABLED = process.env.EXPO_PUBLIC_TEST_TELEMETRY === 'enabled';

export interface TestTelemetryEvent {
  id: string;
  at: string;
  type: string;
  payload?: unknown;
}

let pendingWrite: Promise<void> = Promise.resolve();
let flushing = false;

export function testingTelemetryEnabled(): boolean {
  return TEST_TELEMETRY_ENABLED;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function boundedEvent(event: TestTelemetryEvent): TestTelemetryEvent {
  try {
    if (JSON.stringify(event).length <= MAX_EVENT_BYTES) return event;
  } catch {
    // Fall through to a safe, serializable replacement event.
  }
  return { id: event.id, at: event.at, type: event.type, payload: { truncated: true, reason: 'event_too_large_or_not_serializable' } };
}

async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = newId('test_device');
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

async function readQueue(): Promise<TestTelemetryEvent[]> {
  const stored = await AsyncStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as TestTelemetryEvent[] : [];
  } catch {
    // A damaged optional diagnostics queue must never prevent future startup
    // breadcrumbs or affect the owner's diary.
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

/**
 * This exists only for the owner-authorized preview-test program. It is a
 * best-effort queue: loss of connectivity must never interrupt diary writes.
 */
export function recordTestTelemetry(type: string, payload?: unknown): void {
  if (!TEST_TELEMETRY_ENABLED) return;
  const event = boundedEvent({ id: newId('test'), at: new Date().toISOString(), type: type.slice(0, 80), payload });
  pendingWrite = pendingWrite.then(async () => {
    try {
      const events = await readQueue();
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...events, event].slice(-MAX_QUEUED_EVENTS)));
    } catch {
      // Testing telemetry must never change normal app behaviour.
    }
  });
  void flushTestTelemetry();
}

export async function flushTestTelemetry(): Promise<void> {
  if (!TEST_TELEMETRY_ENABLED) return;
  if (flushing) return;
  flushing = true;
  try {
    await pendingWrite;
    while (true) {
      const events = await readQueue();
      if (!events.length) return;
      const batch = events.slice(0, BATCH_SIZE);
      await postTestTelemetry(await deviceId(), batch);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(batch.length)));
    }
  } catch {
    // Keep the queue for the next app start, foreground event, or state write.
  } finally {
    flushing = false;
  }
}

export async function clearRemoteTestTelemetry(): Promise<void> {
  if (!TEST_TELEMETRY_ENABLED) return;
  await pendingWrite;
  const id = await deviceId();
  await resetTestTelemetry(id);
  await AsyncStorage.removeItem(QUEUE_KEY);
}
