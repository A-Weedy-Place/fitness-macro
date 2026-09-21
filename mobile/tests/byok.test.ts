import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as transport from '../src/services/ai/groqTransport';
import { sanitizeDiagnostic } from '../src/logic/redactSecrets';
import { SerialExecutor } from '../src/storage/serialStore';
import { utf8Bytes } from '../src/logic/bytes';

const key = 'gsk_' + 'synthetic_test_only_'.repeat(3);
function load(path: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { FormData, exports: {} as Record<string, any>, require: (name: string) => { if (name in modules) return modules[name]; throw new Error(`Unexpected dependency: ${name}`); } };
  runInNewContext(code, context); return context.exports;
}

test('credentials go only to fixed Groq paths; missing key and invalid destinations never fetch', async () => {
  let calls = 0;
  const fetcher = (async (url: string, init: RequestInit) => {
    calls++; assert.equal(url, 'https://api.groq.com/openai/v1/models');
    assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${key}`);
    assert.equal(init.redirect, 'error'); return new Response('{}');
  }) as typeof fetch;
  await transport.groqFetch(key, '/models', {}, 100, fetcher);
  await assert.rejects(transport.groqFetch('', '/models', {}, 100, fetcher), /Add your own/);
  await assert.rejects(transport.groqFetch(key, 'https://evil.test' as any, {}, 100, fetcher), /Unsupported/);
  assert.equal(calls, 1);
});

test('model validation spends no completion and public catalogue carries no authorization', async () => {
  const original = globalThis.fetch; const calls: string[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push(url);
    if (url.includes('api.groq.com')) return Response.json({ data: [{ id: transport.REASONING_MODEL }, { id: transport.SPEECH_MODEL }] });
    assert.ok(!('authorization' in (init.headers || {}))); return Response.json({});
  }) as typeof fetch;
  try {
    await transport.validateGroqKey(key);
    await transport.publicFetch('https://world.openfoodfacts.org/api/v2/product/123');
    await assert.rejects(transport.publicFetch('https://evil.test'), /invalid_public_endpoint/);
    assert.equal(calls.length, 2); assert.ok(calls[0].endsWith('/models'));
  } finally { globalThis.fetch = original; }
});

test('provider and native errors never expose raw secrets and quota keeps retry timing', () => {
  for (const status of [401, 403, 429, 500]) {
    const error = transport.providerError(new Response(key, { status, headers: { 'retry-after': '120' } }));
    assert.ok(!error.message.includes(key));
    if (status === 429) assert.equal(error.retryAfterSeconds, 120);
  }
  assert.ok(!transport.safeAiError(new Error(key)).message.includes(key));
  assert.ok(!JSON.stringify(sanitizeDiagnostic({ apiKey: key, command: `pasted ${key}`, authorization: 'Bearer example' })).includes(key));
});

test('transcription uploads multipart directly and manual search does not request a key', async () => {
  let keyRequests = 0; let uploads = 0;
  class AudioFile extends Blob { exists = true; constructor(_uri: string) { super(['audio'], { type: 'audio/mp4' }); } }
  const api = load('../src/services/agentClient.ts', {
    'expo-file-system': { File: AudioFile },
    'expo/fetch': { fetch: async (url: string, init: RequestInit) => {
      uploads++; assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
      assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${key}`);
      assert.ok(init.body instanceof FormData); assert.equal(init.body.get('model'), transport.SPEECH_MODEL);
      assert.ok(init.body.get('file') instanceof Blob); return Response.json({ text: ' two rotis ' });
    } },
    './groqKey': { requireGroqKey: async () => { keyRequests++; return key; }, hasGroqKey: async () => true },
    './ai/planner': { searchOpenFoodFacts: async () => [] }, './ai/groqTransport': transport
  });
  await api.searchFoods('roti'); assert.equal(keyRequests, 0);
  const result = await api.transcribeRecording('file:///recording.m4a');
  assert.equal(result.text, 'two rotis'); assert.equal(result.retained, false); assert.equal(uploads, 1); assert.equal(keyRequests, 1);
});

test('secure storage validates before replacing, supports removal and never falls back to plaintext', async () => {
  const data = new Map<string, string>(); let invalid = false; let failStorage = false;
  const secure = { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    getItemAsync: async (name: string) => { if (failStorage) throw new Error(key); return data.get(name) ?? null; },
    setItemAsync: async (name: string, value: string) => { data.set(name, value); },
    deleteItemAsync: async (name: string) => { data.delete(name); } };
  const api = load('../src/services/groqKey.ts', { 'expo-secure-store': secure, './ai/groqTransport': { ...transport, validateGroqKey: async () => { if (invalid) throw new Error('rejected'); } } });
  await assert.rejects(api.requireGroqKey(), /Add your Groq/);
  await api.saveGroqKey(` ${key} `); assert.equal(await api.getGroqKey(), key);
  invalid = true; await assert.rejects(api.saveGroqKey(key + 'new'), /rejected/); assert.equal(await api.getGroqKey(), key);
  await api.removeGroqKey(); assert.equal(await api.hasGroqKey(), false);
  failStorage = true; await assert.rejects(api.getGroqKey(), /Secure key storage is unavailable/);
});

test('optional local history defaults off, redacts secrets, is bounded and clears without diary loss', async () => {
  const data = new Map<string, string>([['diary', 'keep']]);
  const storage = { getItem: async (name: string) => data.get(name) ?? null, setItem: async (name: string, value: string) => { data.set(name, value); }, removeItem: async (name: string) => { data.delete(name); } };
  const api = load('../src/logic/localDiagnostics.ts', { '@react-native-async-storage/async-storage': storage, '../storage/serialStore': { SerialExecutor }, './bytes': { utf8Bytes }, './redactSecrets': { sanitizeDiagnostic } });
  await api.initializeLocalDiagnostics(); api.recordLocalDiagnostic('off', { key });
  assert.equal(JSON.parse(await api.exportLocalDiagnostics()).events.length, 0);
  await api.setLocalDiagnosticsEnabled(true);
  for (let i = 0; i < 410; i++) api.recordLocalDiagnostic('action', { command: key });
  const exported = await api.exportLocalDiagnostics(); assert.ok(!exported.includes(key)); assert.equal(JSON.parse(exported).events.length, 400);
  await api.clearLocalDiagnostics(); assert.equal(data.get('diary'), 'keep'); assert.equal(JSON.parse(await api.exportLocalDiagnostics()).events.length, 0);
});
