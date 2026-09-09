import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { AssistantPlan, DailyGoal, FoodItem, UserProfile } from '../types';
import type { TestTelemetryEvent } from '../logic/testTelemetry';

// This public HTTPS address identifies the relay, not a secret. The Groq key stays only in Cloudflare.
const RELAY_BASE_URL = 'https://fitness-macro-relay.fitness-macro-relay.workers.dev';
const BUILD_ACCESS_TOKEN = process.env.EXPO_PUBLIC_RELAY_ACCESS_TOKEN?.trim() || '';

class RelayError extends Error {
  code: string;
  retryAfterSeconds?: number;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RelayError';
    this.code = code;
  }
}

function responseCode(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed.error === 'string' ? parsed.error : 'unknown_relay_error';
  } catch {
    return 'invalid_relay_error';
  }
}

function missingBuildToken(): Error {
  return new RelayError('unauthorized_app', 'This APK does not include the AI service. Install the latest private test build.');
}

function friendlyError(status: number, body: string): Error {
  const code = responseCode(body);
  if (status === 401) return missingBuildToken();
  if (status === 429) {
    let retry = 60;
    try { retry = Math.max(1, Math.min(3600, Number(JSON.parse(body).retryAfterSeconds) || 60)); } catch { /* Use a bounded retry hint. */ }
    const source = code.startsWith('relay_') ? 'This app’s request allowance' : 'Groq’s free allowance';
    const error = new RelayError(code, `${source} is temporarily reached. Try again in about ${Math.ceil(retry / 60)} minute${retry > 60 ? 's' : ''}. Your diary is unchanged; manual logging still works.`);
    error.retryAfterSeconds = retry; return error;
  }
  if (status === 504) return new RelayError(code, 'The AI service took too long. Please try again.');
  if (code === 'food_not_found') return new RelayError(code, 'No nutrition data was found for that barcode.');
  if (['groq_empty_response', 'groq_invalid_response', 'groq_invalid_plan', 'groq_incomplete_plan'].includes(code)) {
    return new RelayError(code, 'The AI returned an incomplete action plan, so nothing was changed. Please try again.');
  }
  if (code.startsWith('groq_request_failed_')) return new RelayError(code, 'The AI provider could not complete that request. Nothing was changed; please try again shortly.');
  return new RelayError(code, 'The AI service is temporarily unavailable. Please try again.');
}

function headers(contentType = 'application/json'): Record<string, string> {
  if (!BUILD_ACCESS_TOKEN) throw missingBuildToken();
  return { 'content-type': contentType, 'x-fitnessmacro-app-token': BUILD_ACCESS_TOKEN };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), path.includes('/assistant/') ? 115_000 : path.includes('/foods/') ? 10_000 : 55_000);
  try {
    const response = await fetch(`${RELAY_BASE_URL}${path}`, { ...init, signal: controller.signal, headers: { ...headers(), ...(init.headers as Record<string, string> || {}) } });
    if (!response.ok) throw friendlyError(response.status, await response.text());
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new RelayError('connection_timeout', 'The connection timed out. Nothing was changed; please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export interface SearchFoodResponse {
  query: string;
  items: FoodItem[];
  fromCache: boolean;
  cachedCount: number;
}

export interface ResolveFoodResponse {
  transcript: string;
  candidates: FoodItem[];
  suggestions?: Array<{ foodId: string; quantity: number; unit: string; confidence: number; sourceUrl?: string }>;
  notes: string[];
  plan?: {
    intent: 'log_foods' | 'create_recipe_and_log' | 'clarify';
    title: string;
    summary: string;
    requiresConfirmation: boolean;
    clarification?: string;
    dish?: { name: string; servings: number; finalWeightGrams: number };
    items: Array<{ foodId: string; quantity: number; unit: string; confidence: number }>;
    log: { date: string; eatenAt: string; quantity: number };
  };
}

export interface GoalReviewResponse {
  goal: DailyGoal;
  bmr: number;
  tdee: number;
  review: {
    summary: string;
    actions: string[];
    cautions: string[];
    meals: Array<{ label: string; time: string; targetCalories: number; targetProtein: number; foods: string[] }>;
    sources: Array<{ title: string; url: string }>;
    aiGenerated: boolean;
  };
}

export async function getGoalRecommendation(profile: UserProfile): Promise<GoalReviewResponse> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = profile;
  return request('/v1/goals/recommendation', { method: 'POST', body: JSON.stringify(input) });
}

export async function searchFoods(query: string, limit = 8): Promise<SearchFoodResponse> {
  return request(`/v1/foods/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`);
}

export async function lookupFoodByBarcode(code: string): Promise<{ item: FoodItem }> {
  return request(`/v1/foods/barcode/${encodeURIComponent(code.trim())}`);
}

export async function resolveTranscript(transcript: string, defaultDate: string, defaultTime?: string, context?: unknown): Promise<ResolveFoodResponse> {
  return request('/v1/agent/command', { method: 'POST', body: JSON.stringify({ transcript, defaultDate, defaultTime, context }) });
}

export async function planAssistantCommand(command: string, context: unknown): Promise<AssistantPlan> {
  return request('/v1/assistant/plan', { method: 'POST', body: JSON.stringify({ command, context }) });
}

export async function transcribeRecording(uri: string): Promise<{ text: string; engine: string; retained: boolean }> {
  if (!BUILD_ACCESS_TOKEN) throw missingBuildToken();
  const audio = new File(uri);
  if (!audio.exists || audio.size <= 0) throw new Error('The phone created an empty recording. Please record again.');
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'm4a';
  const mimeType = audio.type || (extension === 'webm' ? 'audio/webm' : extension === 'wav' ? 'audio/wav' : 'audio/mp4');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await expoFetch(`${RELAY_BASE_URL}/v1/audio/transcribe`, { method: 'POST', signal: controller.signal, headers: { ...headers(mimeType), 'x-audio-filename': `food-recording.${extension}` }, body: audio });
    if (!response.ok) throw friendlyError(response.status, await response.text());
    return await response.json() as { text: string; engine: string; retained: boolean };
  } finally { clearTimeout(timeout); }
}

export async function audioStatus(): Promise<{ configured: boolean; retention: string; provider?: string; mode?: string; model?: string }> {
  return request('/v1/audio/status');
}

export async function agentStatus(): Promise<{
  appAgent: { enabled: boolean; provider: string; busy: boolean; timeoutSeconds: number };
  foodAgent: { enabled: boolean; provider: string; liveSearch: boolean; busy: boolean; timeoutSeconds: number };
}> {
  return request('/v1/agent/status');
}

export async function postTestTelemetry(deviceId: string, events: TestTelemetryEvent[]): Promise<void> {
  await request('/v1/test-telemetry', { method: 'POST', body: JSON.stringify({ deviceId, events }) });
}

export async function resetTestTelemetry(deviceId: string): Promise<void> {
  await request('/v1/test-telemetry/reset', { method: 'POST', body: JSON.stringify({ deviceId }) });
}
