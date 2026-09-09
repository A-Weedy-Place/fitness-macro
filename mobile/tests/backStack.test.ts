import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackStack } from '../src/logic/backStack';

test('Back dismisses an inner screen before the root irrespective of registration order', () => {
  const stack = createBackStack(); const visited: string[] = [];
  let panel = true;
  stack.add(10, () => { if (!panel) return false; panel = false; visited.push('account'); return true; });
  stack.add(0, () => { visited.push('today'); return true; });
  assert.equal(stack.back(), true); assert.deepEqual(visited, ['account']);
  assert.equal(stack.back(), true); assert.deepEqual(visited, ['account', 'today']);
});

test('Back falls through only at root, removes unmounted handlers and prioritizes newest peers', () => {
  const stack = createBackStack(); const visited: string[] = [];
  stack.add(0, () => false);
  assert.equal(stack.back(), false);
  const removeOld = stack.add(10, () => { visited.push('old'); return true; });
  const removeNew = stack.add(10, () => { visited.push('new'); return true; });
  stack.back(); removeNew(); stack.back(); removeOld();
  assert.deepEqual(visited, ['new', 'old']); assert.equal(stack.back(), false);
});
