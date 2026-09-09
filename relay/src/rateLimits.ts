export type RouteBucket = 'status' | 'catalogue' | 'reasoning' | 'transcription' | 'telemetry' | 'other';
export function routeBucket(path: string): RouteBucket {
  if (path.startsWith('/v1/test-telemetry')) return 'telemetry';
  if (path.endsWith('/status')) return 'status';
  if (path.startsWith('/v1/foods/') || path.startsWith('/v1/recipes/')) return 'catalogue';
  if (path === '/v1/audio/transcribe') return 'transcription';
  if (['/v1/assistant/plan', '/v1/agent/command', '/v1/goals/recommendation'].includes(path)) return 'reasoning';
  return 'other';
}
const LIMITS: Record<RouteBucket, number> = { status: 600, catalogue: 120, reasoning: 60, transcription: 60, telemetry: 240, other: 60 };
const fallback = new Map<string, { start: number; count: number }>();

/** D1 makes the private preview's counters consistent across Worker instances. */
export async function consumeRouteBudget(bucket: RouteBucket, database?: D1Database, now = Date.now()): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + 3_600_000 - now) / 1000));
  let count: number;
  if (database) {
    const result = await database.prepare('INSERT INTO relay_rate_limits (bucket, window_start, request_count) VALUES (?, ?, 1) ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, request_count = CASE WHEN relay_rate_limits.window_start = excluded.window_start THEN relay_rate_limits.request_count + 1 ELSE 1 END RETURNING request_count')
      .bind(bucket, windowStart).first<{ request_count: number }>();
    if (!result) throw new Error('relay_limit_unavailable');
    count = result.request_count;
  } else {
    // Local development only. Public hosting still needs its own account limits.
    const current = fallback.get(bucket);
    const next = { start: windowStart, count: current?.start === windowStart ? current.count + 1 : 1 };
    fallback.set(bucket, next); count = next.count;
  }
  return { allowed: count <= LIMITS[bucket], retryAfterSeconds };
}

export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  const numeric = Number(value);
  if (value && Number.isFinite(numeric) && numeric >= 0) return Math.max(1, Math.min(86_400, Math.ceil(numeric)));
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? Math.max(1, Math.min(86_400, Math.ceil((date - now) / 1000))) : 60;
}
