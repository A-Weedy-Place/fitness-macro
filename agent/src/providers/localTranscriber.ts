export interface TranscriptionResult {
  text: string;
  engine: string;
}

export function transcriberConfigured(): boolean {
  return Boolean(process.env.LOCAL_TRANSCRIBE_URL);
}

export async function transcribeAudio(input: {
  audio: Buffer;
  mimeType: string;
  filename: string;
}): Promise<TranscriptionResult> {
  const baseUrl = process.env.LOCAL_TRANSCRIBE_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('transcriber_not_configured');
  const mode = process.env.LOCAL_TRANSCRIBE_MODE?.trim().toLowerCase() === 'whisper_cpp'
    ? 'whisper_cpp'
    : 'openai_compatible';
  const endpoint = mode === 'whisper_cpp'
    ? (baseUrl.endsWith('/inference') ? baseUrl : `${baseUrl}/inference`)
    : (baseUrl.endsWith('/audio/transcriptions') ? baseUrl : `${baseUrl}/v1/audio/transcriptions`);
  const form = new FormData();
  const audioCopy = new Uint8Array(input.audio.byteLength);
  audioCopy.set(input.audio);
  form.append('file', new Blob([audioCopy.buffer], { type: input.mimeType }), input.filename);
  if (mode === 'whisper_cpp') {
    form.append('response_format', 'json');
  } else {
    form.append('model', process.env.LOCAL_TRANSCRIBE_MODEL || 'whisper-1');
  }
  const headers: Record<string, string> = {};
  if (process.env.LOCAL_TRANSCRIBE_KEY) headers.authorization = `Bearer ${process.env.LOCAL_TRANSCRIBE_KEY}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: form });
  if (!response.ok) throw new Error(`transcriber_failed_${response.status}`);
  const payload = await response.json() as { text?: string; transcription?: string };
  const text = String(payload.text || payload.transcription || '').trim();
  if (!text) throw new Error('empty_transcription');
  return { text, engine: `${mode}:${new URL(endpoint).host}` };
}
