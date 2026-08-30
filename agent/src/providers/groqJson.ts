export interface GroqUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
}

export interface GroqJsonResult<T> {
  value: T;
  usage: GroqUsage;
  model: string;
}

interface GroqChatPayload {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
  error?: { message?: string; code?: string };
}

function groqError(status: number, payload: GroqChatPayload, retryAfter: string | null): Error {
  if (status === 429) {
    const suffix = retryAfter ? `_retry_after_${retryAfter}s` : '';
    return new Error(`groq_free_limit_reached${suffix}`);
  }
  const detail = String(payload.error?.code || payload.error?.message || `http_${status}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 120);
  return new Error(`groq_request_failed_${detail}`);
}

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function groqStatus() {
  return {
    configured: groqConfigured(),
    model: process.env.GROQ_AGENT_MODEL || 'openai/gpt-oss-120b',
    freeTierOnly: true,
    paidToolsEnabled: false
  };
}

function freeAllowlistedModel(): string {
  const model = process.env.GROQ_AGENT_MODEL || 'openai/gpt-oss-120b';
  if (model !== 'openai/gpt-oss-120b' && model !== 'openai/gpt-oss-20b') {
    throw new Error('groq_model_not_free_allowlisted');
  }
  return model;
}

export async function requestGroqJson<T>(input: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<GroqJsonResult<T>> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('groq_not_configured');

  const model = freeAllowlistedModel();
  const timeoutMs = Math.max(5_000, Number(process.env.GROQ_TIMEOUT_SECONDS || 45) * 1000);
  const maxCompletionTokens = Math.min(Math.max(Number(process.env.GROQ_MAX_COMPLETION_TOKENS || 2400), 256), 4096);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user }
        ],
        reasoning_effort: 'low',
        temperature: 0.1,
        max_completion_tokens: maxCompletionTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: input.schemaName, strict: true, schema: input.schema }
        }
      })
    });
    const payload = await response.json() as GroqChatPayload;
    if (!response.ok) throw groqError(response.status, payload, response.headers.get('retry-after'));
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('groq_empty_response');
    let value: T;
    try {
      value = JSON.parse(content) as T;
    } catch {
      throw new Error('groq_invalid_json');
    }
    const usage: GroqUsage = {
      promptTokens: payload.usage?.prompt_tokens || 0,
      completionTokens: payload.usage?.completion_tokens || 0,
      totalTokens: payload.usage?.total_tokens || 0,
      cachedTokens: payload.usage?.prompt_tokens_details?.cached_tokens || 0
    };
    console.info(`[agent] Groq ${payload.model || model}: ${usage.promptTokens} input + ${usage.completionTokens} output tokens (${usage.cachedTokens} cached)`);
    return { value, usage, model: payload.model || model };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('groq_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
