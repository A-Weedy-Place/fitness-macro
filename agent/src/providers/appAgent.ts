import { codexAppAgentStatus, planAppCommand as planAppCommandWithCodex } from './codexAppAgent.js';
import type { AppAgentPlan } from './codexAppAgent.js';
import { groqConfigured, groqStatus } from './groqJson.js';
import { planAppCommandWithGroq } from './groqAppAgent.js';

type Provider = 'auto' | 'groq' | 'codex';

function configuredProvider(): Provider {
  const value = process.env.APP_AGENT_PROVIDER?.trim().toLowerCase();
  return value === 'groq' || value === 'codex' ? value : 'auto';
}

export function appAgentStatus() {
  const requested = configuredProvider();
  const codex = codexAppAgentStatus();
  const selected = requested === 'auto' ? (groqConfigured() ? 'groq' : codex.enabled ? 'codex' : 'none') : requested;
  return {
    enabled: selected === 'groq' ? groqConfigured() : selected === 'codex' ? codex.enabled : false,
    provider: selected,
    requestedProvider: requested,
    busy: codex.busy,
    timeoutSeconds: selected === 'groq' ? Number(process.env.GROQ_TIMEOUT_SECONDS || 45) : codex.timeoutSeconds,
    groq: groqStatus(),
    codex
  };
}

export async function planAppCommand(command: string, context: unknown): Promise<AppAgentPlan> {
  const provider = configuredProvider();
  if (provider === 'groq') return planAppCommandWithGroq(command, context);
  if (provider === 'codex') return planAppCommandWithCodex(command, context);
  if (groqConfigured()) {
    try {
      return await planAppCommandWithGroq(command, context);
    } catch (error) {
      if (!codexAppAgentStatus().enabled) throw error;
      console.warn(`[agent] Groq app planner fallback to Codex: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  return planAppCommandWithCodex(command, context);
}
