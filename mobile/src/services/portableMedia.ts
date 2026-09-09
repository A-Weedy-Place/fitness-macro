import { Directory, File, FileMode, Paths } from 'expo-file-system';
import * as LegacyFiles from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { AppState } from '../types';
import { createPortableBackup } from '../logic/backup';
import { utf8Bytes } from '../logic/bytes';
import { embeddedImage, imageMimeFromHeader, SupportedImageMime } from '../logic/imageFormat';

const mediaDirectory = new Directory(Paths.document, 'owner-media');
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_EXPORT_BYTES = 19_000_000;
const MAX_IMPORT_BYTES = 20_000_000;

function imageMime(file: File): SupportedImageMime {
  const handle = file.open(FileMode.ReadOnly);
  try {
    const mime = imageMimeFromHeader(handle.readBytes(12));
    if (!mime) throw new Error('Use a JPEG, PNG, or WebP photo. Other image formats must be converted before saving.');
    return mime;
  } finally { handle.close(); }
}

/** Copy picker/cache files into durable app storage before committing their URI. */
export async function retainImage(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  mediaDirectory.create({ intermediates: true, idempotent: true });
  const embedded = embeddedImage(uri, MAX_IMAGE_BYTES);
  if (embedded) {
    const extension = embedded.mime === 'image/jpeg' ? 'jpg' : embedded.mime.slice(6);
    const target = new File(mediaDirectory, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
    try {
      target.create(); target.write(embedded.base64, { encoding: 'base64' });
      if (imageMime(target) !== embedded.mime) throw new Error('A backup photo does not match its declared image format.');
      return target.uri;
    } catch (error) { if (target.exists) target.delete(); throw error; }
  }
  if (!uri.startsWith('file:') && !uri.startsWith('content:')) throw new Error('Choose a JPEG, PNG, or WebP photo stored on this device.');
  const source = new File(uri);
  if (!source.exists) throw new Error('That photo is no longer on this device. Please choose it again.');
  if (source.size > MAX_IMAGE_BYTES) throw new Error('Choose a smaller photo (under 2 MB).');
  const mime = imageMime(source);
  const ownPrefix = `${mediaDirectory.uri.replace(/\/$/, '')}/`;
  if (uri.startsWith(ownPrefix)) return uri;
  const target = new File(mediaDirectory, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${mime === 'image/jpeg' ? 'jpg' : mime.slice(6)}`);
  try { await source.copy(target); }
  catch (error) { if (target.exists) target.delete(); throw error; }
  return target.uri;
}

export async function materializeBackupMedia(state: AppState): Promise<AppState> {
  const copy = new Map<string, string | undefined>();
  async function restore(uri?: string) {
    if (!uri) return undefined;
    if (copy.has(uri)) return copy.get(uri);
    // Old device-only paths are not portable. Do not pretend their photos survived.
    if (!uri.startsWith('data:')) {
      try { if (!new File(uri).exists) return undefined; } catch { return undefined; }
    }
    const retained = await retainImage(uri); copy.set(uri, retained); return retained;
  }
  const foods = [];
  for (const food of state.foods) foods.push({ ...food, imageUri: await restore(food.imageUri) });
  return { ...state, foods, profile: state.profile ? { ...state.profile, profilePhotoUri: await restore(state.profile.profilePhotoUri) } : undefined };
}

export async function exportBackupWithMedia(state: AppState): Promise<string> {
  const cache = new Map<string, string>();
  async function embed(uri?: string) {
    if (!uri) return undefined;
    if (cache.has(uri)) return cache.get(uri);
    const file = new File(uri);
    if (!file.exists) throw new Error('A saved photo is missing. Remove or replace it before exporting, so the backup is complete.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('A saved photo is too large to back up. Replace it with an image under 2 MB.');
    const mime = imageMime(file);
    const value = `data:${mime};base64,${await file.base64()}`;
    cache.set(uri, value); return value;
  }
  const foods = [];
  for (const food of state.foods) foods.push({ ...food, imageUri: await embed(food.imageUri) });
  const text = createPortableBackup({ ...state, foods, profile: state.profile ? { ...state.profile, profilePhotoUri: await embed(state.profile.profilePhotoUri) } : undefined });
  if (utf8Bytes(text) > MAX_EXPORT_BYTES) throw new Error('This backup exceeds the 19 MB portable limit. Reduce large photos before exporting.');
  return text;
}

export async function savePortableBackupFile(text: string, date: string): Promise<boolean> {
  if (Platform.OS !== 'android') { const result = await Share.share({ title: 'Weed Fitness backup', message: text }); return result.action !== Share.dismissedAction; }
  const access = await LegacyFiles.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!access.granted) return false;
  const uri = await LegacyFiles.StorageAccessFramework.createFileAsync(access.directoryUri, `Weed-Fitness-${date}-${Date.now()}`, 'application/json');
  await LegacyFiles.StorageAccessFramework.writeAsStringAsync(uri, text);
  return true;
}

export async function pickPortableBackupFile(): Promise<{ read: () => Promise<string> } | null> {
  // Native picker understands opaque provider IDs, file names and MIME types.
  // This API is already included in the installed SDK57 binary.
  const selected = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'], multipleFiles: false });
  if (selected.canceled) return null;
  const file = selected.result;
  if (file.size > MAX_IMPORT_BYTES) throw new Error('This backup exceeds the 20 MB import limit.');
  return { read: async () => {
    const text = await file.text();
    if (utf8Bytes(text) > MAX_IMPORT_BYTES) throw new Error('This backup exceeds the 20 MB import limit.');
    return text;
  } };
}
