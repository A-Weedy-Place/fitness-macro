# Direct Groq voice and food agent

1. User records temporary audio with the microphone button.
2. The phone sends multipart audio directly to Groq `whisper-large-v3-turbo` using the user's SecureStore key.
3. The returned transcript fills the editable input. No reasoning or logging is automatic.
4. User deliberately sends the text. The on-phone planner builds bounded local context and calls Groq `openai/gpt-oss-120b`.
5. Strict schema/domain checks validate proposed actions. Nullable-field recovery cannot invent quantities. Correction and optional Wikibooks reference refinement share a maximum of two model calls.
6. User confirms; the app applies changes atomically to its local store.

No server or model runs on a PC. Models are not downloaded to the phone. There is no Cloudflare relay, shared developer key or fallback credential.

Manual Open Food Facts lookup uses a separate unauthenticated transport. Only fixed Groq endpoints accept the API key. Keys stay outside diary state, backups, logs and source. User key validation reads the model list, not generated tokens. Groq handles submitted information under its own account/privacy policies.

App-generated audio is temporary and existing cleanup remains active. Provider retention is not controlled by the app. Rate-limit errors report the user's Groq allowance and retry guidance; no automatic paid fallback occurs.
