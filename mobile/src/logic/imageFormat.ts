export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** MIME comes from image bytes, not an extension or untrusted provider label. */
export function imageMimeFromHeader(bytes: Uint8Array): SupportedImageMime | null {
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (prefix(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (prefix(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (prefix(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

export function embeddedImage(uri: string, maxBytes: number): { mime: SupportedImageMime; base64: string } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);
  if (!match) return null;
  const base64 = match[2];
  if (!base64 || base64.length % 4 !== 0) throw new Error('This backup contains malformed photo data.');
  const bytes = base64.length * 3 / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  if (bytes > maxBytes) throw new Error('This backup photo is too large. Maximum photo size is 2 MB.');
  return { mime: match[1] as SupportedImageMime, base64 };
}
