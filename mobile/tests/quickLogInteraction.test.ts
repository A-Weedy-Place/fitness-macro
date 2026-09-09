import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the component's handlers and render structure without a native-device dependency.
function harness(save: () => Promise<void> = async () => {}) {
  const slots: any[] = []; let cursor = 0; const effects: Array<() => void> = [];
  const alerts: any[][] = []; let closed = 0; let saves = 0;
  const react = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    useState: (initial: any) => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value: any) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef: (initial: any) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo: (fn: () => any) => fn(),
    useEffect: (fn: () => void, deps: any[]) => { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((dep, i) => dep !== previous[i])) { slots[index] = deps; effects.push(fn); } }
  };
  const colors = new Proxy({}, { get: () => '#111111' });
  const native = new Proxy({ Platform: { OS: 'android' }, Alert: { alert: (...args: any[]) => alerts.push(args) }, AccessibilityInfo: { announceForAccessibility: () => {} } }, { get: (target: any, key) => target[key] ?? key });
  const context: any = { exports: {}, setTimeout: () => 1, clearTimeout: () => {}, require: (name: string) => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 24 }) };
    if (name === '../theme') return { colors, themedStyles: (fn: () => any) => fn() };
    if (name === '../hooks/useAndroidBack') return { dismissKeyboardFirst: () => false };
    if (name === '../logic/nutrition') return { nutritionForEntry: () => ({ calories: 195, protein: 7, fat: 2, carbs: 39 }) };
    if (name === '../logic/foodVisual') return { foodEmoji: () => '🥖' };
    if (name === '../logic/portions') return { servingQuantityForDisplay: (_food: any, amount: number) => amount };
    if (name === '../logic/resolvedPortions') return { resolvedServingQuantity: (_food: any, amount: number) => amount };
    return new Proxy({}, { get: (_target, key) => key });
  } };
  const source = readFileSync(new URL('../src/components/QuickLogSheet.tsx', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, context);
  const food = { id: 'roti', name: 'Roti', serving: { amount: 1, unit: 'piece' }, nutrition: { calories: 260, protein: 9, fat: 2, carbs: 52 }, source: { source: 'manual' } };
  const props = { visible: true, initialTime: '09:00', foods: [food], onClose: () => { closed++; }, onLog: async () => { saves++; await save(); } };
  function render(): any { cursor = 0; const node = context.exports.QuickLogSheet(props); while (effects.length) effects.shift()!(); return node; }
  render();
  function nodes(node: any): any[] { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
  function find(predicate: (node: any) => boolean) { const found = nodes(render()).find(predicate); assert.ok(found, 'Expected UI node'); return found; }
  function select() { find((node) => typeof node.props?.onAdd === 'function').props.onAdd(food); }
  return { render, nodes, find, select, alerts, closed: () => closed, saves: () => saves };
}

test('selection has a fixed review control, Undo and no diary write before confirmation', () => {
  const h = harness(); h.select();
  const review = h.find((node) => node.props?.accessibilityLabel === 'Review 1 selected foods');
  assert.equal(h.saves(), 0);
  const scrolls = h.nodes(h.render()).filter((node) => node.type === 'ScrollView');
  assert.ok(scrolls.every((node) => !h.nodes(node).some((child) => child.props?.accessibilityLabel === 'Review 1 selected foods')));
  review.props.onPress();
  assert.equal(h.find((node) => node.props?.accessibilityLabel === 'Review 1 selected foods').props.accessibilityState.expanded, true);
  h.find((node) => node.props?.accessibilityLabel === 'Undo last food selection').props.onPress();
  h.find((node) => node.props?.accessibilityLabel === 'Review 0 selected foods');
  assert.equal(h.saves(), 0);
});

test('Back collapses review before offering draft discard, never silently closes selection', () => {
  const h = harness(); h.select();
  h.find((node) => node.props?.accessibilityLabel === 'Review 1 selected foods').props.onPress();
  h.find((node) => node.type === 'Modal').props.onRequestClose();
  assert.equal(h.closed(), 0); assert.equal(h.alerts.length, 0);
  h.find((node) => node.type === 'Modal').props.onRequestClose();
  assert.equal(h.closed(), 0); assert.equal(h.alerts[0][0], 'Discard selected foods?');
  h.alerts[0][2].find((button: any) => button.text === 'Discard').onPress();
  assert.equal(h.closed(), 1);
});

test('double Apply saves once and closes only after durable success; errors retain the draft', async () => {
  let finish!: () => void;
  const h = harness(() => new Promise<void>((resolve) => { finish = resolve; })); h.select();
  const button = h.find((node) => node.type === 'Button' && node.props.label === 'Log 1 food now');
  button.props.onPress(); button.props.onPress();
  assert.equal(h.saves(), 1); assert.equal(h.closed(), 0);
  h.find((node) => node.type === 'Modal').props.onRequestClose(); assert.equal(h.closed(), 0);
  finish(); await new Promise((resolve) => setImmediate(resolve)); assert.equal(h.closed(), 1);
  const failed = harness(async () => { throw new Error('disk full'); }); failed.select();
  failed.find((node) => node.type === 'Button' && node.props.label === 'Log 1 food now').props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed.closed(), 0); failed.find((node) => node.props?.accessibilityLabel === 'Review 1 selected foods');
});
