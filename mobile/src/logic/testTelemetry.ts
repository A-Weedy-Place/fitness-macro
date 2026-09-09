import AsyncStorage from '@react-native-async-storage/async-storage';
import { postTestTelemetry, resetTestTelemetry } from '../services/agentClient';
import { TelemetryQueue, TelemetryQueueStatus } from './telemetryQueue';
export type { TestTelemetryEvent } from './telemetryQueue';

const DEVICE_KEY = 'weed-fitness-test-device-v1';
const QUEUE_KEY = 'weed-fitness-test-telemetry-queue-v1';
const TEST_TELEMETRY_ENABLED = process.env.EXPO_PUBLIC_TEST_TELEMETRY === 'enabled';
let devicePromise: Promise<string> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2_000;
let resetting = false;

export function testingTelemetryEnabled(): boolean { return TEST_TELEMETRY_ENABLED; }
function newId(prefix: string): string { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }

function deviceId(): Promise<string> {
  if (!devicePromise) devicePromise = (async () => {
    const existing = await AsyncStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = newId('test_device');
    await AsyncStorage.setItem(DEVICE_KEY, created);
    return created;
  })().catch((error) => { devicePromise = undefined; throw error; });
  return devicePromise;
}

const queue = new TelemetryQueue(AsyncStorage, QUEUE_KEY, deviceId, postTestTelemetry);

/** Preview-only, bounded, observable diagnostics. Stable retry event IDs let
 * the server deduplicate. Failures must never block a diary write. */
export function recordTestTelemetry(type: string, payload?: unknown): void {
  if (!TEST_TELEMETRY_ENABLED) return;
  void queue.enqueue({ id: newId('test'), at: new Date().toISOString(), type: type.slice(0, 80), payload }).then(() => {
    // New taps must not defeat an existing offline/rate-limit backoff.
    if (!retryTimer) return flushTestTelemetry();
  }).catch(() => undefined);
}

export async function telemetryQueueStatus(): Promise<TelemetryQueueStatus> {
  return TEST_TELEMETRY_ENABLED ? queue.status() : { queued: 0, dropped: 0, truncated: 0 };
}

export async function flushTestTelemetry(): Promise<void> {
  if (!TEST_TELEMETRY_ENABLED || resetting) return;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
  await queue.flush();
  const status = await queue.status();
  if (status.queued && !resetting) {
    if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = undefined; void flushTestTelemetry(); }, retryDelay);
    retryDelay = Math.min(60_000, retryDelay * 2);
  } else retryDelay = 2_000;
}

export async function clearRemoteTestTelemetry(): Promise<void> {
  if (!TEST_TELEMETRY_ENABLED) return;
  resetting = true;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
  try { await queue.reset(resetTestTelemetry); }
  finally { resetting = false; void flushTestTelemetry(); }
}
