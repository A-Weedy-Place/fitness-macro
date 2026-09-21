// Ported integration fixtures exercise the on-device planner, not a hosted server.
import { planCommand, resolveFood } from '../../src/services/ai/planner';
import { AiError } from '../../src/services/ai/groqTransport';
export const plannerHarness = {
  async fetch(request: Request, credentials: { apiKey: string }): Promise<Response> {
    const input = await request.json() as Record<string, unknown>;
    try {
      const result = new URL(request.url).pathname.endsWith('/plan')
        ? await planCommand(String(input.command), input.context, credentials)
        : await resolveFood(input, credentials);
      return Response.json(result);
    } catch (error) {
      const retry = error instanceof AiError ? error.retryAfterSeconds : undefined;
      return Response.json({ error: error instanceof AiError ? error.code : 'invalid_plan', ...(retry ? { retryAfterSeconds: retry } : {}) }, { status: retry ? 429 : 502, headers: retry ? { 'retry-after': String(retry) } : {} });
    }
  }
};
