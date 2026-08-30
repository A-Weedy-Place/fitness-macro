import type { ResolveResponse } from '../contracts.js';
import { codexResolverStatus, resolveFoodWithCodex } from './codexFoodResolver.js';
import { resolveFoodWithGroq } from './groqFoodResolver.js';
import { groqConfigured, groqStatus } from './groqJson.js';
import { compactAppContext } from './appContext.js';

type Provider = 'auto' | 'groq' | 'codex' | 'deterministic';

function configuredProvider(): Provider {
  const value = process.env.FOOD_AGENT_PROVIDER?.trim().toLowerCase();
  return value === 'groq' || value === 'codex' || value === 'deterministic' ? value : 'auto';
}

export function foodAgentStatus() {
  const requested = configuredProvider();
  const codex = codexResolverStatus();
  const selected = requested === 'auto' ? (groqConfigured() ? 'groq' : codex.enabled ? 'codex' : 'deterministic') : requested;
  return {
    enabled: selected === 'groq' ? groqConfigured() : selected === 'codex' ? codex.enabled : selected === 'deterministic',
    provider: selected,
    requestedProvider: requested,
    liveSearch: selected === 'codex' && codex.liveSearch,
    busy: codex.busy,
    timeoutSeconds: selected === 'groq' ? Number(process.env.GROQ_TIMEOUT_SECONDS || 45) : codex.timeoutSeconds,
    groq: groqStatus(),
    codex
  };
}

export async function resolveFoodWithAgent(transcript: string, defaultDate: string, defaultTime?: string, context?: unknown): Promise<ResolveResponse | null> {
  const provider = configuredProvider();
  const compactContext = compactAppContext(transcript, context);
  if (provider === 'deterministic') return null;
  if (provider === 'groq') return resolveFoodWithGroq(transcript, defaultDate, defaultTime, compactContext);
  if (provider === 'codex') return resolveFoodWithCodex(transcript, defaultDate, defaultTime, compactContext);
  if (groqConfigured()) {
    try {
      return await resolveFoodWithGroq(transcript, defaultDate, defaultTime, compactContext);
    } catch (error) {
      if (!codexResolverStatus().enabled) throw error;
      console.warn(`[agent] Groq food resolver fallback to Codex: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  return resolveFoodWithCodex(transcript, defaultDate, defaultTime, compactContext);
}
