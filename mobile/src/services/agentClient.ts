import {
  ActivityEntry,
  ActivityInput,
  AgentActionPlan,
  AssistantPlan,
  BodyMetricLog,
  CustomFoodInput,
  DailyGoal,
  FoodEntry,
  FoodEntryInput,
  FoodItem,
  MealPlan,
  MealPlanInput,
  ProfileInput,
  UserProfile,
  WeightInput
} from '../types';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

const BASE_URL = process.env.EXPO_PUBLIC_AGENT_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8787';
const TOKEN = process.env.EXPO_PUBLIC_AGENT_PAIRING_TOKEN || 'dev-local-token';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-agent-token': TOKEN };
  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers as Record<string, string>)) headers[key] = String(value);
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Agent returned ${response.status}: ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export interface SearchFoodResponse {
  query: string;
  items: FoodItem[];
  fromCache: boolean;
  cachedCount: number;
}

export interface StravaStatus {
  configured: boolean;
  connected: boolean;
  athleteId?: number;
  expiresAt?: number;
  scope?: string;
  redirectUri?: string;
}

export interface ResolveFoodResponse {
  transcript: string;
  candidates: FoodItem[];
  suggestions?: Array<{ foodId: string; quantity: number; unit: string; confidence: number; sourceUrl?: string }>;
  notes: string[];
  plan?: AgentActionPlan;
}

export interface GoalReviewResponse {
  goal: DailyGoal;
  bmr: number;
  tdee: number;
  review: { summary: string; actions: string[]; cautions: string[]; aiGenerated: boolean };
}

export async function getGoalRecommendation(profile: UserProfile): Promise<GoalReviewResponse> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = profile;
  return request('/v1/goals/recommendation', { method: 'POST', body: JSON.stringify(input) });
}

export async function searchFoods(query: string, limit = 10): Promise<SearchFoodResponse> {
  return request(`/v1/foods/search?q=${encodeURIComponent(query.trim())}&limit=${limit}`);
}

export async function lookupFoodByBarcode(code: string): Promise<{ item: FoodItem }> {
  return request(`/v1/foods/barcode/${encodeURIComponent(code.trim())}`);
}

export async function createCustomFood(payload: CustomFoodInput) {
  return request<{ item: FoodItem }>('/v1/foods/custom', { method: 'POST', body: JSON.stringify(payload) });
}

export async function resolveTranscript(transcript: string, defaultDate: string, defaultTime?: string, context?: unknown) {
  return request<ResolveFoodResponse>('/v1/agent/command', {
    method: 'POST',
    body: JSON.stringify({ transcript, defaultDate, defaultTime, context })
  });
}

export async function planAssistantCommand(command: string, context: unknown): Promise<AssistantPlan> {
  return request('/v1/assistant/plan', { method: 'POST', body: JSON.stringify({ command, context }) });
}

export async function transcribeRecording(uri: string): Promise<{ text: string; engine: string; retained: boolean }> {
  const audio = new File(uri);
  if (!audio.exists || audio.size <= 0) throw new Error('The phone created an empty recording. Please record again.');
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'm4a';
  const mimeType = audio.type || (extension === 'webm' ? 'audio/webm' : extension === 'wav' ? 'audio/wav' : 'audio/mp4');
  const response = await expoFetch(`${BASE_URL}/v1/audio/transcribe`, {
    method: 'POST',
    headers: {
      'content-type': mimeType,
      'x-agent-token': TOKEN,
      'x-audio-filename': `food-recording.${extension}`
    },
    body: audio
  });
  if (!response.ok) throw new Error(`Transcription unavailable (${response.status}): ${await response.text()}`);
  return await response.json() as { text: string; engine: string; retained: boolean };
}

export async function audioStatus(): Promise<{ configured: boolean; retention: string; provider?: string; mode?: string; model?: string }> {
  return request('/v1/audio/status');
}

export async function agentStatus(): Promise<{
  appAgent: { enabled: boolean; provider: string; busy: boolean; timeoutSeconds: number };
  foodAgent: { enabled: boolean; provider: string; liveSearch: boolean; busy: boolean; timeoutSeconds: number };
  codexAppAgent: { enabled: boolean; provider?: string; busy: boolean; timeoutSeconds: number };
  codexFoodResolver: { enabled: boolean; provider?: string; liveSearch: boolean; busy: boolean; timeoutSeconds: number };
}> {
  return request('/v1/agent/status');
}

export async function getStravaStatus(): Promise<StravaStatus> {
  return request('/v1/integrations/strava/status');
}

export async function getStravaAuthorizationUrl(): Promise<string> {
  const response = await request<{ url: string }>('/v1/integrations/strava/authorize-url');
  return response.url;
}

export async function syncStrava(after: string): Promise<{ imported: number; activities: ActivityEntry[] }> {
  return request('/v1/integrations/strava/sync', { method: 'POST', body: JSON.stringify({ after }) });
}

export async function upsertEntry(payload: FoodEntryInput) {
  return request<{ item: FoodEntry }>('/v1/entries', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logWeight(payload: WeightInput) {
  return request<{ item: BodyMetricLog }>('/v1/weights', { method: 'POST', body: JSON.stringify(payload) });
}

export async function logActivity(payload: ActivityInput) {
  return request<{ item: ActivityEntry }>('/v1/activities', { method: 'POST', body: JSON.stringify(payload) });
}

export async function saveProfile(payload: ProfileInput) {
  return request<{ profile: UserProfile; recommendedGoal: DailyGoal; bmr: number; tdee: number }>('/v1/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function saveGoal(payload: DailyGoal) {
  return request<{ item: DailyGoal }>(`/v1/goals/${payload.date}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function listEntriesForDate(date: string): Promise<FoodEntry[]> {
  return request(`/v1/entries?date=${encodeURIComponent(date)}`);
}

export async function listAllEntries(): Promise<FoodEntry[]> {
  return request('/v1/entries');
}

export async function listWeights(from?: string, to?: string): Promise<BodyMetricLog[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return request(`/v1/weights${query ? `?${query}` : ''}`);
}

export async function listActivities(from?: string, to?: string): Promise<ActivityEntry[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return request(`/v1/activities${query ? `?${query}` : ''}`);
}

export async function listGoals(from?: string, to?: string): Promise<DailyGoal[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return request(`/v1/goals${query ? `?${query}` : ''}`);
}

export async function saveMealPlan(payload: MealPlanInput) {
  return request<{ item: MealPlan }>('/v1/plans', { method: 'POST', body: JSON.stringify(payload) });
}

export async function listPlans(): Promise<MealPlan[]> {
  return request('/v1/plans');
}

export async function deleteEntry(id: string): Promise<void> {
  return deleteRequest(`/v1/entries/${encodeURIComponent(id)}`);
}

export async function deleteWeight(id: string): Promise<void> {
  return deleteRequest(`/v1/weights/${encodeURIComponent(id)}`);
}

export async function deleteActivity(id: string): Promise<void> {
  return deleteRequest(`/v1/activities/${encodeURIComponent(id)}`);
}

export async function deletePlan(id: string): Promise<void> {
  return deleteRequest(`/v1/plans/${encodeURIComponent(id)}`);
}

async function deleteRequest(path: string): Promise<void> {
  try {
    await request<void>(path, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) return;
    throw error;
  }
}
