# Weed Fitness

A standalone, local-first Android nutrition diary built with Expo/React Native. Diary, cookbook, recipes, goals, trends, profile, PIN and backups stay on the phone.

## AI: bring your own Groq key

In **You → AI & API key**, open Groq, create your own key, paste it, and tap **Save & check**. The key is stored using device SecureStore, separate from diary state and backups. It is never supplied by this repository or a shared developer backend.

```text
Phone → Groq API (user's key)
      → Open Food Facts / Wikibooks (public, no key)
```

- Speech: `whisper-large-v3-turbo`; reasoning: `openai/gpt-oss-120b`.
- No PC, Cloudflare relay, shared access token, Codex CLI or bundled local model.
- AI proposes validated actions; you review and confirm before local diary changes.
- Manual logging, saved/reference search, recipes and trends work without an AI key. Online catalogue lookup requires internet but not a key.
- Use a Groq Free account if you require free usage. Your account's limits and billing apply; the app cannot turn a paid account into a free one.
- Optional diagnostic history stays on the phone and is shared only explicitly. No automatic cloud collection.

## Development

`mobile/` contains the app, planner and tests. Run `npm ci`, `npm run typecheck`, and `npm test` there. No server deployment or AI environment variables are required.

See [test guide](docs/standalone-testing.md), [release workflow](docs/releases-and-updates.md), and [context](context.md). Related changes use one issue, one tested/versioned PR and one release. Compatible updates use EAS; native changes need a new APK.

## Privacy

AI requests send relevant text/profile/diary context or recordings directly to Groq under its policies. Keys are excluded from app-generated backups/diagnostic exports. Removing a saved key disables future AI calls but does not revoke it at Groq or cancel an already-sent request. Never paste keys into issues or chat.
