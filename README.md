# FitnessMacro

FitnessMacro is a standalone, local-first Android nutrition diary. The app keeps the diary, cookbook, recipes, goals, trends, profile, local PIN, and backups on the phone.

AI is online but does not require a PC or a user-supplied API key:

```text
FitnessMacro APK → private Cloudflare Worker → Groq
                         └→ encrypted GROQ_API_KEY secret
```

- Speech-to-text: Groq `whisper-large-v3-turbo`.
- Food and action planning: Groq `openai/gpt-oss-120b`.
- Safe deterministic target calculation remains in the app; AI only proposes confirmation-gated actions and meal structure.
- The Worker does not persist raw audio, diary entries, recipes, or profile data.

## Repository layout

- `mobile/` — Expo/React Native app and local-first data store (schema 7).
- `relay/` — Cloudflare Worker which holds the Groq key in an encrypted secret and exposes only the required AI and Open Food Facts routes.
- `context.md` and `obsidian/` — maintained project memory and design decisions.

## Owner testing

An installable Android preview APK is built with EAS. It already contains the relay address and a rotatable private-test access token; the tester does not enter a key or connect to a PC. See [standalone testing](docs/standalone-testing.md).

## Development and releases

Changes are developed through issues and pull requests, checked by GitHub Actions, and released with Semantic Versioning. Installed builds receive compatible JavaScript and asset updates through EAS Update; native changes are shipped as a new signed APK. See [releases and in-app updates](docs/releases-and-updates.md) and [contributing](CONTRIBUTING.md).

## Security boundary

The Groq key is never committed or bundled in the APK. The current private test build contains a separate relay access token, which is rotatable but extractable from an APK; it protects against casual abuse only. Add real account/device authentication before broader distribution.
