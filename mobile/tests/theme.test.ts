import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadTheme() {
  const files = new Map<string, string>(); let failWrites = false; let notifications = 0;
  class File {
    uri: string;
    constructor(...parts: string[]) { this.uri = parts.join('/'); }
    get exists() { return files.has(this.uri); }
    textSync() { return files.get(this.uri) || ''; }
    create() { files.set(this.uri, ''); }
    write(value: string) { if (failWrites) throw new Error('disk_full'); files.set(this.uri, value); }
    delete() { files.delete(this.uri); }
  }
  const code = ts.transpileModule(readFileSync(fileURLToPath(new URL('../src/theme.ts', import.meta.url)), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {} as Record<string, any>, require: (name: string) => {
    if (name === 'expo-file-system') return { File, Paths: { document: 'documents' } };
    if (name === 'react-native') return { StyleSheet: { create: (styles: unknown) => styles } };
    if (name === 'react') return { useSyncExternalStore: (subscribe: (listener: () => void) => unknown, snapshot: () => string) => { subscribe(() => { notifications += 1; }); return snapshot(); } };
    throw new Error(`Unexpected native dependency: ${name}`);
  } };
  runInNewContext(code, context);
  return { theme: context.exports, notifications: () => notifications, failWrites: () => { failWrites = true; } };
}

test('live theme invalidates existing style factories and shadows without replacing their handles', () => {
  const { theme, notifications } = loadTheme();
  theme.useAppTheme();
  const styles = theme.themedStyles(() => ({ card: { color: theme.colors.ink, ...theme.shadows.card } }));
  const handle = styles;
  assert.equal(styles.card.color, '#1D2C25'); assert.equal(styles.card.shadowOpacity, 0.08);
  theme.saveAppTheme('charcoal');
  assert.equal(styles, handle); assert.equal(styles.card.color, '#F4F1E9'); assert.equal(styles.card.shadowOpacity, 0.2);
  assert.equal(theme.isDarkTheme, true); assert.equal(notifications(), 1);
  theme.saveAppTheme('warm'); assert.equal(styles.card.color, '#1D2C25'); assert.equal(theme.activeTheme, 'warm');
});

test('failed appearance persistence leaves the displayed theme and subscriptions unchanged', () => {
  const { theme, notifications, failWrites } = loadTheme();
  theme.useAppTheme(); failWrites();
  assert.throws(() => theme.saveAppTheme('ocean'), /disk_full/);
  assert.equal(theme.activeTheme, 'warm'); assert.equal(notifications(), 0);
});
