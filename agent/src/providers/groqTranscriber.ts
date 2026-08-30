const TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo';
const TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

export interface TranscriptionResult {
  text: string;
  engine: string;
}

export function transcriberConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function transcriberStatus() {
  return {
    configured: transcriberConfigured(),
    provider: transcriberConfigured() ? 'groq' : 'not_configured',
    mode: 'hosted',
    model: TRANSCRIPTION_MODEL
  };
}

export async function transcribeAudio(input: {
  audio: Buffer;
  mimeType: string;
  filename: string;
}): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('groq_not_configured');

  const form = new FormData();
  const audioCopy = new Uint8Array(input.audio.byteLength);
  audioCopy.set(input.audio);
  form.append('file', new Blob([audioCopy.buffer], { type: input.mimeType }), input.filename);
  form.append('model', TRANSCRIPTION_MODEL);

  const controller = new AbortController();
  const timeoutMs = Math.max(5_000, Number(process.env.GROQ_TIMEOUT_SECONDS || 45) * 1000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(TRANSCRIPTION_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${apiKey}` },
      body: form
    });
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`groq_free_limit_reached${retryAfter ? `_retry_after_${retryAfter}s` : ''}`);
    }
    if (!response.ok) throw new Error(`groq_transcription_failed_${response.status}`);
    const payload = await response.json() as { text?: string };
    const text = String(payload.text || '').trim();
    if (!text) throw new Error('empty_transcription');
    return { text, engine: `groq:${TRANSCRIPTION_MODEL}` };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('groq_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
