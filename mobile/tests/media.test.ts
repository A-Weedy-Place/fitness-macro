import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { embeddedImage, imageMimeFromHeader } from '../src/logic/imageFormat';
import { utf8Bytes } from '../src/logic/bytes';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function loadMedia() {
  const files = new Map<string, Buffer>(); let selected: unknown = { canceled: true }; let pickerOptions: any;
  class File {
    uri: string;
    constructor(...parts: Array<string | { uri: string }>) { this.uri = parts.map((part) => typeof part === 'string' ? part : part.uri).join('/'); }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.byteLength || 0; }
    create() { files.set(this.uri, Buffer.alloc(0)); }
    write(text: string, options: { encoding?: string }) { files.set(this.uri, Buffer.from(text, options.encoding === 'base64' ? 'base64' : 'utf8')); }
    open(mode: string) { assert.equal(mode, 'r'); return { readBytes: (count: number) => new Uint8Array(files.get(this.uri)!.subarray(0, count)), close: () => undefined }; }
    delete() { files.delete(this.uri); }
    async copy(target: File) { files.set(target.uri, Buffer.from(files.get(this.uri)!)); }
    async base64() { return files.get(this.uri)!.toString('base64'); }
    async text() { return files.get(this.uri)!.toString('utf8'); }
    static async pickFileAsync(options: unknown) { pickerOptions = options; return selected; }
  }
  class Directory { uri: string; constructor(...parts: string[]) { this.uri = parts.join('/'); } create() {} }
  const code = ts.transpileModule(readFileSync(fileURLToPath(new URL('../src/services/portableMedia.ts', import.meta.url)), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {} as Record<string, any>, require: (name: string) => {
    if (name === 'expo-file-system') return { File, Directory, FileMode: { ReadOnly: 'r' }, Paths: { document: 'file:///documents' } };
    if (name === 'expo-file-system/legacy') return {};
    if (name === 'react-native') return { Platform: { OS: 'android' }, Share: {} };
    if (name.endsWith('/backup')) return { createPortableBackup: (state: unknown) => JSON.stringify({ state }) };
    if (name.endsWith('/bytes')) return { utf8Bytes };
    if (name.endsWith('/imageFormat')) return { embeddedImage, imageMimeFromHeader };
    throw new Error(`Unexpected dependency ${name}`);
  } };
  runInNewContext(code, context);
  return { media: context.exports, files, select: (uri: string) => { selected = { canceled: false, result: new File(uri) }; }, options: () => pickerOptions };
}

test('image MIME detection uses bytes and rejects unsupported or mislabeled files', () => {
  assert.equal(imageMimeFromHeader(png), 'image/png'); assert.equal(imageMimeFromHeader(jpeg), 'image/jpeg');
  assert.equal(imageMimeFromHeader(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(imageMimeFromHeader(Buffer.from('GIF89a')), null);
  assert.throws(() => embeddedImage('data:image/png;base64,abc', 100), /malformed/);
  assert.throws(() => embeddedImage(`data:image/png;base64,${png.toString('base64')}`, 4), /too large/);
});

test('opaque provider photo copies durably and exports with correct byte-derived MIME', async () => {
  const { media, files } = loadMedia(); const source = 'content://provider/document/42'; files.set(source, png);
  const retained = await media.retainImage(source);
  assert.match(retained, /^file:\/\/\/documents\/owner-media\/photo-.*\.png$/); assert.deepEqual(files.get(retained), png);
  const text = await media.exportBackupWithMedia({ foods: [{ id: 'food', imageUri: retained }] });
  assert.equal(JSON.parse(text).state.foods[0].imageUri, `data:image/png;base64,${png.toString('base64')}`);
});

test('mismatched embedded image MIME is rejected and only the newly created file is cleaned', async () => {
  const { media, files } = loadMedia(); files.set('file:///existing-photo', png);
  await assert.rejects(media.retainImage(`data:image/jpeg;base64,${png.toString('base64')}`), /declared image format/);
  assert.deepEqual([...files.keys()], ['file:///existing-photo']);
});

test('native backup picker supports opaque document IDs and treats cancellation as no selection', async () => {
  const { media, files, select, options } = loadMedia();
  assert.equal(await media.pickPortableBackupFile(), null);
  const uri = 'content://documents/provider/93425'; files.set(uri, Buffer.from('{"format":"fitness-macro-backup"}')); select(uri);
  const result = await media.pickPortableBackupFile();
  assert.equal(await result.read(), '{"format":"fitness-macro-backup"}');
  assert.equal(options().multipleFiles, false); assert.ok(options().mimeTypes.includes('application/json'));
});
