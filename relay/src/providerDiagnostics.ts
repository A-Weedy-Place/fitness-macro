type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
const CODES = new Set(['invalid_request_error', 'json_validate_failed', 'json_schema_invalid', 'invalid_json_schema', 'context_length_exceeded', 'model_not_found', 'model_decommissioned', 'model_permission_blocked', 'invalid_api_key', 'rate_limit_exceeded', 'server_error', 'invalid_value']);
const PARAMS = new Set(['model', 'messages', 'max_completion_tokens', 'max_tokens', 'temperature', 'reasoning_effort', 'response_format', 'response_format.json_schema', 'response_format.json_schema.schema', 'service_tier', 'include_reasoning']);
const SCHEMAS = new Set(['fitness_app_action_plan', 'fitness_food_resolution', 'nutrition_program_advice']);

/** Never log error.message/failed_generation: providers may echo private input. */
export function providerDiagnostic(status: number, payload: unknown, requestId: string | null, schemaName: string, maxCompletionTokens: number) {
  const error = record(record(payload)?.error);
  const code = typeof error?.code === 'string' && CODES.has(error.code) ? error.code : 'unclassified';
  const type = typeof error?.type === 'string' && CODES.has(error.type) ? error.type : 'unclassified';
  const param = typeof error?.param === 'string' && PARAMS.has(error.param) ? error.param : 'unclassified';
  const message = typeof error?.message === 'string' ? error.message.slice(0, 4000) : '';
  const category = code === 'json_validate_failed' || /generated.*json|json.*(?:generated|validation)/i.test(message) ? 'generated_json_validation'
    : /json.?schema|additionalProperties|maxItems|minItems|anyOf/i.test(message) ? 'schema_rejected'
    : /maximum.*tokens|context.*length|too.*many.*tokens|max_completion_tokens|max_tokens/i.test(message) ? 'token_or_context_limit'
    : /reasoning_effort|temperature|response_format|unsupported.*parameter/i.test(message) ? 'parameter_rejected'
    : /model.*(?:exist|permission|access|available|decommission|support)/i.test(message) ? 'model_unavailable'
    : status === 429 ? 'rate_limit' : 'unclassified';
  return {
    event: 'groq_request_failed', status, code, type, param, category,
    requestId: requestId && /^req_[A-Za-z0-9_-]{1,100}$/.test(requestId) ? requestId : undefined,
    schema: SCHEMAS.has(schemaName) ? schemaName : 'unclassified',
    model: 'openai/gpt-oss-120b',
    maxCompletionTokens: Number.isFinite(maxCompletionTokens) ? Math.max(0, Math.min(20_000, maxCompletionTokens)) : undefined
  };
}
