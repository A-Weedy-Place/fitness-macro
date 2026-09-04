import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssistantPlan } from '../types';
import { recordTestTelemetry } from './testTelemetry';

const KEY = 'weed-fitness-ai-diagnostics-v1';
const MAX_EVENTS = 120;
let pendingWrite: Promise<void> = Promise.resolve();

export type DiagnosticArea = 'assistant' | 'quick_log' | 'voice';
export type DiagnosticOutcome = 'requested' | 'plan_ready' | 'no_action' | 'apply_requested' | 'applied' | 'failed';

export interface AiDiagnosticEvent {
  id: string;
  at: string;
  area: DiagnosticArea;
  outcome: DiagnosticOutcome;
  command?: string;
  reply?: string;
  error?: string;
  actions?: Array<{ type: string; name?: string | null; date?: string | null; time?: string | null; targetId?: string | null }>;
  appliedChanges?: number;
}

function clip(value: string | undefined, limit = 900): string | undefined {
  if (!value) return undefined;
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

export function diagnosticActions(plan: AssistantPlan | undefined): AiDiagnosticEvent['actions'] {
  return plan?.actions.map((action) => ({ type: action.type, name: action.name, date: action.date, time: action.time, targetId: action.targetId })) || [];
}

export function recordAiDiagnostic(input: Omit<AiDiagnosticEvent, 'id' | 'at' | 'command' | 'reply' | 'error'> & Pick<AiDiagnosticEvent, 'command' | 'reply' | 'error'>): void {
  const event: AiDiagnosticEvent = { ...input, id: `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), command: clip(input.command), reply: clip(input.reply), error: clip(input.error, 500) };
  recordTestTelemetry('ai_diagnostic', event);
  pendingWrite = pendingWrite.then(async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY);
      const current = stored ? JSON.parse(stored) as AiDiagnosticEvent[] : [];
      await AsyncStorage.setItem(KEY, JSON.stringify([...current, event].slice(-MAX_EVENTS)));
    } catch {
      // Diagnostics must never interfere with food logging or an AI action.
    }
  });
}

export async function exportAiDiagnostics(): Promise<string> {
  try {
    await pendingWrite;
    const stored = await AsyncStorage.getItem(KEY);
    const events = stored ? JSON.parse(stored) as AiDiagnosticEvent[] : [];
    return JSON.stringify({ format: 'weed-fitness-ai-diagnostics', exportedAt: new Date().toISOString(), privacy: 'Created only when the owner explicitly shares it. It includes AI commands, assistant replies, proposed action metadata, and errors; it never includes API keys or raw audio.', events }, null, 2);
  } catch {
    return JSON.stringify({ format: 'weed-fitness-ai-diagnostics', exportedAt: new Date().toISOString(), events: [] }, null, 2);
  }
}
