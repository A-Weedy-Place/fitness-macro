import * as SecureStore from 'expo-secure-store';
import { AiError, normalizeGroqKey, validateGroqKey } from './ai/groqTransport';

const KEY = 'weed-fitness-user-groq-key-v1';
const options = { keychainService: 'weed-fitness-ai', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function getGroqKey(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY, options); }
  catch { throw new AiError('key_storage_unavailable', 'Secure key storage is unavailable. Unlock your phone and try again.'); }
}
export async function requireGroqKey(): Promise<string> {
  const key = await getGroqKey();
  if (!key) throw new AiError('groq_key_required', 'Add your Groq API key in You → AI & API key. Manual logging still works without one.');
  return key;
}
export async function saveGroqKey(value: string): Promise<void> {
  const key = normalizeGroqKey(value);
  // Failed validation never overwrites a working key. Never put this in app/backup state.
  await validateGroqKey(key);
  try { await SecureStore.setItemAsync(KEY, key, options); }
  catch { throw new AiError('key_storage_failed', 'The phone could not save your key securely. Your previous key was not replaced.'); }
}
export async function removeGroqKey(): Promise<void> {
  try { await SecureStore.deleteItemAsync(KEY, options); }
  catch { throw new AiError('key_storage_failed', 'The phone could not remove the key. Please try again.'); }
}
export async function hasGroqKey(): Promise<boolean> { return Boolean(await getGroqKey()); }
export async function checkSavedGroqKey(): Promise<void> { await validateGroqKey(await requireGroqKey()); }
