# Weed Fitness mobile

Expo SDK 57 / React Native 0.86, local-first nutrition journal.

AI now uses each user's Groq key configured in **You → AI & API key**. Whisper transcription and GPT-OSS planning call Groq directly. SecureStore holds the key; no relay, PC, shared token or automatic cloud diagnostics is used.

Manual diary, recipes, goals and trends work without a key. Public catalogue search also requires no AI key.

Run `npm ci`, `npm run typecheck`, and `npm test` here. See [test guide](../docs/standalone-testing.md). Native runtime stays 0.2.2 until native dependencies/configuration change.
