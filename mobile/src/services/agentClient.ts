import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { AssistantPlan, DailyGoal, FoodItem, UserProfile } from '../types';
import { hasGroqKey, requireGroqKey } from './groqKey';
import { planCommand, resolveFood, nutritionProgram, searchOpenFoodFacts, lookupOpenFoodFacts } from './ai/planner';
import { AiError, groqFetch, providerError, safeAiError, SPEECH_MODEL } from './ai/groqTransport';

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


async function withKey<T>(run: (credentials: { apiKey: string }) => Promise<unknown>): Promise<T> {
  try { return await run({ apiKey: await requireGroqKey() }) as T; }
  catch (error) { throw safeAiError(error); }
}
export async function getGoalRecommendation(profile: UserProfile): Promise<GoalReviewResponse> {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = profile;
  return withKey((credentials) => nutritionProgram(input, credentials));
}
export async function searchFoods(query: string, limit = 8): Promise<SearchFoodResponse> {
  const term = query.trim().slice(0, 120);
  if (!term) return { query: term, items: [], fromCache: false, cachedCount: 0 };
  const items = await searchOpenFoodFacts(term) as unknown as FoodItem[];
  return { query: term, items: items.slice(0, Math.min(8, Math.max(1, limit))), fromCache: false, cachedCount: 0 };
}
export async function lookupFoodByBarcode(code: string): Promise<{ item: FoodItem }> {
  try { return { item: await lookupOpenFoodFacts(code.trim()) as unknown as FoodItem }; }
  catch { throw new AiError('food_not_found', 'No food was found for this barcode, or the catalogue is offline. Add it manually from the label.'); }
}
export async function resolveTranscript(transcript: string, defaultDate: string, defaultTime?: string, context?: unknown): Promise<ResolveFoodResponse> {
  return withKey((credentials) => resolveFood({ transcript, defaultDate, defaultTime, context }, credentials));
}
export async function planAssistantCommand(command: string, context: unknown): Promise<AssistantPlan> {
  return withKey((credentials) => planCommand(command, context, credentials));
}
export async function transcribeRecording(uri: string): Promise<{ text: string; engine: string; retained: boolean }> {
  const apiKey = await requireGroqKey();
  const audio = new File(uri);
  if (!audio.exists || audio.size <= 0) throw new AiError('empty_recording', 'The recording is empty. Please record again.');
  if (audio.size > 25 * 1024 * 1024) throw new AiError('audio_too_large', 'Keep the recording below 25 MB. Record a shorter message.');
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'm4a';
  const form = new FormData();
  // Expo File implements Blob; expo/fetch supports this multipart upload on native.
  form.append('file', audio, `food-recording.${extension}`);
  form.append('model', SPEECH_MODEL); form.append('response_format', 'json');
  form.append('prompt', 'Food diary: roti, chapati, paratha, biryani, mash ki dal, aloo keema, chai, lassi.');
  try {
    const response = await groqFetch(apiKey, '/audio/transcriptions', { method: 'POST', body: form }, 60000, expoFetch as typeof fetch);
    if (!response.ok) throw providerError(response);
    const result = await response.json() as { text?: unknown };
    if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 8000) throw new Error('groq_empty_response');
    return { text: result.text.trim(), engine: SPEECH_MODEL, retained: false };
  } catch (error) { throw safeAiError(error); }
}
export async function audioStatus() {
  return { configured: await hasGroqKey(), retention: 'Groq account policy', provider: 'groq', mode: 'direct_user_key', model: SPEECH_MODEL };
}
export async function agentStatus() {
  const enabled = await hasGroqKey();
  return { appAgent: { enabled, provider: 'groq-direct', busy: false, timeoutSeconds: 110 }, foodAgent: { enabled, provider: 'groq-direct', liveSearch: false, busy: false, timeoutSeconds: 45 } };
}
