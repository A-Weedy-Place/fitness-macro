/** Defensive redaction for user-pasted keys; configured secrets never enter diagnostic inputs. */
export function redactSecrets(text: string): string {
  return text.replace(/\bgsk_[A-Za-z0-9_-]+/g, '[REDACTED GROQ KEY]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, '[REDACTED KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}
export function sanitizeDiagnostic(value: unknown): unknown {
  try {
    return JSON.parse(redactSecrets(JSON.stringify(value, (name, item) => /(?:api.?key|authorization|access.?token|password|secret|^pin$)/i.test(name) ? '[REDACTED]' : item)));
  } catch { return { unavailable: true }; }
}
