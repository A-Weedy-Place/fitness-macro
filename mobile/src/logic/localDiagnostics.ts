import AsyncStorage from '@react-native-async-storage/async-storage';
import { SerialExecutor } from '../storage/serialStore';
import { utf8Bytes } from './bytes';
import { sanitizeDiagnostic } from './redactSecrets';

const EVENTS = 'weed-fitness-local-diagnostics-v1';
const ENABLED = 'weed-fitness-local-diagnostics-enabled-v1';
const serial = new SerialExecutor();
let enabled = false;
let initialization: Promise<void> | undefined;
interface LocalEvent { at: string; type: string; payload?: unknown }
export function localDiagnosticsEnabled(): boolean { return enabled; }
export function initializeLocalDiagnostics(): Promise<void> {
  if (!initialization) initialization = AsyncStorage.getItem(ENABLED).then((value) => { enabled = value === 'true'; }).catch(() => { enabled = false; initialization = undefined; });
  return initialization;
}
export async function setLocalDiagnosticsEnabled(value: boolean): Promise<void> {
  await initializeLocalDiagnostics();
  await serial.run(async () => { await AsyncStorage.setItem(ENABLED, String(value)); enabled = value; });
}
export function recordLocalDiagnostic(type: string, payload?: unknown): void {
  if (!enabled) return;
  const safe = sanitizeDiagnostic(payload);
  const event: LocalEvent = { at: new Date().toISOString(), type: type.slice(0, 80), payload: utf8Bytes(JSON.stringify(safe)) > 20000 ? { omitted: 'oversize' } : safe };
  void serial.run(async () => {
    if (!enabled) return;
    let events: LocalEvent[] = [];
    try { const parsed = JSON.parse(await AsyncStorage.getItem(EVENTS) || '[]'); if (Array.isArray(parsed)) events = parsed; } catch { /* Replace only corrupt optional diagnostics, never diary data. */ }
    events.push(event);
    while (events.length > 400 || utf8Bytes(JSON.stringify(events)) > 500000) events.shift();
    await AsyncStorage.setItem(EVENTS, JSON.stringify(events));
  }).catch(() => undefined);
}
export async function clearLocalDiagnostics(): Promise<void> {
  await serial.run(async () => {
    await AsyncStorage.removeItem(EVENTS);
    // This obsolete unsent queue is never uploaded by the BYOK app.
    await AsyncStorage.removeItem('weed-fitness-test-telemetry-queue-v1');
    await AsyncStorage.removeItem('weed-fitness-test-device-v1');
  });
}
export async function exportLocalDiagnostics(): Promise<string> {
  return serial.run(async () => JSON.stringify({ format: 'weed-fitness-local-diagnostics', exportedAt: new Date().toISOString(), privacy: 'Stored only on this phone; shared only by an explicit user action. No automatic upload.', events: sanitizeDiagnostic(JSON.parse(await AsyncStorage.getItem(EVENTS) || '[]')) }, null, 2));
}
