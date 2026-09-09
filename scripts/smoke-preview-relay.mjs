// Run via: eas env:exec preview "node ../scripts/smoke-preview-relay.mjs"
// Synthetic read-only proposals only. Never prints or persists credentials.
import assert from 'node:assert/strict';

const token = process.env.EXPO_PUBLIC_RELAY_ACCESS_TOKEN;
if (!token) throw new Error('Preview relay credential was not supplied through EAS.');
const base = process.env.EXPO_PUBLIC_RELAY_URL || 'https://fitness-macro-relay.fitness-macro-relay.workers.dev';
async function request(path, protocol, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-fitnessmacro-app-token': token.trim(), 'content-type': 'application/json', ...(protocol ? { 'X-Weed-Fitness-Protocol': '2' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(115_000)
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`Relay smoke check failed: HTTP ${response.status}; ${value.error || 'unknown_error'}`);
  return value;
}
const status = await request('/v1/agent/status', true);
assert.equal(status.revision, 'audit-hardening-2026-09-09');
assert.equal(status.appAgent.enabled, true);
console.log(JSON.stringify({ check: 'deployed_revision', revision: status.revision, aiConfigured: true }));
const context = {
  currentDate: '2026-09-09', selectedDiaryDate: '2026-09-09',
  userFoods: [{ id: 'synthetic_milk', name: 'Milk, low fat 2%', serving: { unit: 'cup', amount: 1, gramsPerUnit: 244 }, nutrition: { calories: 50, protein: 3.3, carbs: 5, fat: 2 }, source: { source: 'manual', confidence: 1 } }],
  entries: [], recipes: [], plans: [], weights: [], activities: [], goals: [], history: []
};
for (const protocol of [true, false]) {
  const plan = await request('/v1/assistant/plan', protocol, { command: 'Log 150 ml of Milk, low fat 2% at 08:00 today. Use my saved milk.', context });
  const action = plan.actions?.find(item => item.type === 'log_foods');
  assert.ok(action, 'Expected an executable food proposal.');
  assert.equal(action.date, '2026-09-09', 'The proposed diary day must match the command.');
  assert.equal(action.time, '08:00', 'The proposed clock time must match the command.');
  const item = action.ingredients?.find(item => /milk/i.test(item.name));
  assert.ok(item, 'Expected the saved milk.');
  const grams = protocol ? item.quantity * (item.unit === 'ml' || item.unit === 'g' ? 1 : item.gramsPerUnit) : item.quantity * 244;
  if (!protocol) assert.equal(item.unit, 'cup', 'Legacy APK requires saved-unit quantities.');
  assert.ok(Math.abs(grams - 150) < 5, 'Proposal should represent approximately150g, not150cups.');
  console.log(JSON.stringify({ check: protocol ? 'protocol_2_portion' : 'legacy_portion', grams, calories: grams * 0.5, date: action.date, time: action.time }));
}
console.log('Read-only smoke checks passed; no diary mutations or telemetry uploads requested.');
