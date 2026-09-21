import { recoverNullableGeneration } from './structuredRecovery';

export const GROQ_ORIGIN = 'https://api.groq.com';
export const REASONING_MODEL = 'openai/gpt-oss-120b';
export const SPEECH_MODEL = 'whisper-large-v3-turbo';
export type JsonRecord = Record<string, unknown>;
export class AiError extends Error {
  constructor(readonly code: string, message: string, readonly retryAfterSeconds?: number) { super(message); this.name = 'AiError'; }
}
export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  const numeric = Number(value);
  if (value && Number.isFinite(numeric) && numeric >= 0) return Math.max(1, Math.min(86400, Math.ceil(numeric)));
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? Math.max(1, Math.min(86400, Math.ceil((date - now) / 1000))) : 60;
}
export function providerError(response: Response): AiError {
  if (response.status === 401) return new AiError('groq_invalid_key', 'Groq rejected this API key. Replace it in You → AI & API key.');
  if (response.status === 403) return new AiError('groq_access_denied', 'Your Groq account does not have access to this model. Check its model permissions.');
  if (response.status === 429) {
    const retry = retryAfterSeconds(response.headers.get('retry-after'));
    return new AiError('groq_rate_limit', `Your Groq allowance is temporarily reached. Try again in about ${Math.ceil(retry / 60)} minute(s). Manual logging still works.`, retry);
  }
  if (response.status === 413) return new AiError('audio_too_large', 'This recording is too large. Record a shorter message.');
  return new AiError('groq_request_failed', 'Groq could not complete the request. Nothing was applied. Please try again.');
}
export function safeAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  const code = error instanceof Error ? error.message : '';
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return new AiError('groq_timeout', 'The request timed out. Nothing was applied. Please try again.');
  if (['groq_invalid_plan', 'groq_incomplete_plan', 'groq_invalid_response', 'groq_empty_response', 'invalid_request'].includes(code)) return new AiError(code, 'The AI returned an incomplete or invalid plan. Nothing was applied. Please try again.');
  // Never propagate provider bodies, request headers, or arbitrary native error messages.
  return new AiError('connection_failed', 'Could not connect. Check your internet connection and try again.');
}
export function normalizeGroqKey(value: string): string {
  const key = value.trim();
  if (!/^gsk_[A-Za-z0-9_-]{20,240}$/.test(key)) throw new AiError('invalid_key_format', 'Paste a Groq API key beginning with gsk_. Do not enter an OpenAI key or a shared app token.');
  return key;
}

/** Only fixed Groq paths accept credentials. Catalog/reference requests use a separate helper. */
export async function groqFetch(apiKey: string, path: '/models' | '/chat/completions' | '/audio/transcriptions', init: RequestInit = {}, timeoutMs = 45000, transport: typeof fetch = fetch): Promise<Response> {
  if (!apiKey) throw new AiError('groq_key_required', 'Add your own Groq API key in You → AI & API key. Manual food logging works without one.');
  if (!['/models', '/chat/completions', '/audio/transcriptions'].includes(path)) throw new AiError('invalid_endpoint', 'Unsupported AI endpoint.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await transport(`${GROQ_ORIGIN}/openai/v1${path}`, { ...init, redirect: 'error', signal: controller.signal, headers: { ...init.headers as Record<string, string>, authorization: `Bearer ${apiKey}` } });
  } catch (error) { throw safeAiError(error); }
  finally { clearTimeout(timer); }
}

/** Free metadata check, not a generated completion or an audio upload. */
export async function validateGroqKey(value: string): Promise<void> {
  const response = await groqFetch(normalizeGroqKey(value), '/models', {}, 15000);
  if (!response.ok) throw providerError(response);
  try {
    const payload = await response.json() as { data?: Array<{ id: string }> };
    if (!Array.isArray(payload.data)) throw new Error('invalid_response');
    const available = new Set(payload.data.map((model) => model.id));
    if (!available.has(REASONING_MODEL) || !available.has(SPEECH_MODEL)) throw new AiError('groq_models_unavailable', 'The key is accepted, but the required GPT-OSS and Whisper models are not both available to this account.');
  } catch (error) { throw safeAiError(error); }
}

export async function requestGroqJson<T>(credentials: { apiKey: string }, input: { system: string; user: string; schemaName: string; schema: JsonRecord; maxCompletionTokens?: number }): Promise<T> {
  const response = await groqFetch(credentials.apiKey, '/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: REASONING_MODEL, messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.user }], reasoning_effort: 'low', temperature: 0.1, max_completion_tokens: input.maxCompletionTokens || 1000, response_format: { type: 'json_schema', json_schema: { name: input.schemaName, strict: true, schema: input.schema } } })
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const recovered = recoverNullableGeneration(response.status, failure, input.schema);
    if (recovered) return recovered.value as T;
    throw providerError(response);
  }
  try {
    const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
    if (payload.choices?.[0]?.finish_reason === 'length') throw new Error('groq_incomplete_plan');
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('groq_empty_response');
    return JSON.parse(content) as T;
  } catch (error) { throw safeAiError(error); }
}

export async function publicFetch(url: string | URL, timeoutMs = 10000): Promise<Response> {
  const parsed = new URL(String(url));
  if (parsed.protocol !== 'https:' || !['world.openfoodfacts.org', 'en.wikibooks.org'].includes(parsed.hostname)) throw new Error('invalid_public_endpoint');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(String(url), { signal: controller.signal, headers: { 'user-agent': 'WeedFitness/0.3 (https://github.com/A-Weedy-Place/fitness-macro)' } }); }
  finally { clearTimeout(timer); }
}
