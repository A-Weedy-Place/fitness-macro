import test from 'node:test';
import assert from 'node:assert/strict';
import { providerDiagnostic } from '../src/providerDiagnostics';

test('provider diagnostics distinguish400 categories without echoing private message/generation/unknown strings', () => {
  const privateMarker = 'private-diary-and-key-marker';
  const payload = { error: { code: 'json_validate_failed', type: 'invalid_request_error', param: `messages:${privateMarker}`, message: `Generated JSON failed validation: ${privateMarker}`, failed_generation: { secret: privateMarker } } };
  const output = providerDiagnostic(400, payload, `unsafe:${privateMarker}`, 'fitness_app_action_plan', 1800);
  assert.equal(output.category, 'generated_json_validation'); assert.equal(output.code, 'json_validate_failed');
  assert.equal(output.param, 'unclassified'); assert.equal(output.requestId, undefined); assert.equal(JSON.stringify(output).includes(privateMarker), false);
  assert.equal(providerDiagnostic(400, { error: { message: 'Invalid JSON schema: maxItems not supported' } }, null, '', 1800).category, 'schema_rejected');
  assert.equal(providerDiagnostic(400, { error: { message: 'model not available' } }, null, '', 1800).category, 'model_unavailable');
  assert.equal(providerDiagnostic(429, null, null, '', 1800).category, 'rate_limit');
});
