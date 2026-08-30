# Complete local setup and acceptance guide

This app is deliberately useful before any optional integration is configured. Daily food logging, reusable meal plans, custom foods, weight logging, calculations, charts, metrics, exports, and the offline queue run from the mobile app's local database.

## 1. Start the PC agent

From `agent/`, install dependencies and create a private environment file:

```bash
npm install
cp .env.example .env
```

Set `AGENT_PAIRING_TOKEN` to a long random value. Load the file and start the agent:

```bash
set -a
source .env
set +a
npm run dev
```

Keep the PC and phone on the same trusted network. In the mobile **You** tab, set the agent URL to `http://YOUR_PC_LAN_IP:8787` and enter the same pairing token. The status cards distinguish unavailable, configured, and connected services.

For routine use, put the agent behind a local HTTPS reverse proxy or a private overlay network such as Tailscale. Do not port-forward the plain HTTP development server to the public internet.

## 2. Run the mobile app

From `mobile/`:

```bash
npm install
npm start
```

Open the Expo development build on the phone. Camera and microphone permissions are requested only when those features are opened.

## 3. Food logging workflow

The **Today** tab provides meal buckets, calorie and macro progress, quick logging, activity contribution, and entry deletion. Food records are normalized to per-100 g values, while portions retain the unit and quantity used for logging.

The **Food** tab supports:

- Local library search and recent foods.
- Open Food Facts and USDA lookup through the PC agent.
- Camera barcode scanning plus manual barcode entry.
- Custom packaged foods using label values and serving size.
- Voice recording, transcript review, candidate selection, and quantity preservation.
- Saving resolved food into the local library for faster future logging.

The app never silently accepts uncertain AI nutrition. Resolver suggestions carry confidence and source metadata and require user confirmation before being logged.

## 4. Plans and analytics

The **Plans** tab creates reusable daily meal templates from foods already in the library and applies a plan to any selected day. Applied plan items remain normal diary entries, so they can be edited or removed independently.

The **Trends** tab includes:

- Daily calorie bars against the selected target.
- Rolling weight trend and net weight change.
- Macro calorie-share donut.
- Logging consistency heat grid and current streak.
- Calorie adherence and protein-target hit rate.
- Average calories and protein.
- Meal calorie distribution.
- Logged activity duration and estimated energy.

The **You** tab stores body profile inputs, computes Mifflin-St Jeor BMR/TDEE and macro targets, records body weight, manages local-agent settings, and shows integration health.

## 5. Local voice transcription

The required feature is speech-to-text (STT), not text-to-speech (TTS). This repository now includes a free local multilingual Faster Whisper server. Install it once from `agent/` (the model download is several hundred MB):

```bash
npm run voice:setup
```

For normal use, start voice and the PC agent together:

```bash
npm run dev:full
```

The default `base` multilingual model runs on CPU with int8 quantization and can auto-detect English/Urdu. Set `WHISPER_MODEL=small` before setup/start for better accuracy at the cost of a larger model and slower CPU transcription. The server binds only to `127.0.0.1`; the mobile app reaches it indirectly through the paired agent.

Two local server styles are supported:

- `LOCAL_TRANSCRIBE_MODE=whisper_cpp`: points to a whisper.cpp HTTP server. The agent sends in-memory multipart audio to `/inference` and requests JSON.
- `LOCAL_TRANSCRIBE_MODE=openai_compatible`: points to a local OpenAI-compatible transcription server. The agent sends audio to `/v1/audio/transcriptions`.

Audio is uploaded only after recording stops. The agent enforces a 25 MB limit, forwards bytes directly to the configured local service, and does not save raw audio. The mobile recording remains temporary and can be discarded after transcription.

If transcription is unavailable, barcode, typed search, custom food, and manual quick-add remain available.

## 6. Codex-assisted food resolution

Set:

```bash
CODEX_FOOD_RESOLVER_ENABLED=true
CODEX_FOOD_SEARCH=true
```

The resolver uses the existing logged-in `codex` CLI on this PC. It runs one read-only, non-interactive job at a time with a strict JSON output schema and timeout. Search is optional because product discovery may send the food description to internet search providers.

Codex is used only to propose structured candidates. Open Food Facts/USDA and manual entry remain the fallback. Product-source URLs and confidence are kept so unusual regional dishes or packaged products can be checked before logging.

## 7. Strava

Create a Strava API application at `https://www.strava.com/settings/api` and set its client ID, secret, and exact callback URL in `agent/.env`. Strava currently requires a subscription to create an API application, and only the Strava account owner can obtain these credentials. The callback must resolve from the browser completing OAuth. For a phone on the same LAN, use the PC's LAN IP rather than `localhost`.

In **You > Strava**, choose **Connect**, approve `activity:read`, then choose **Sync**. The agent refreshes rotated tokens, paginates recent activities, deduplicates by Strava activity ID, and returns only the metrics used by the app. OAuth tokens are stored separately in `agent/data/strava-secrets.json`, excluded from exports, and ignored by version control.

Imported calories are treated as estimates. When Strava does not provide usable energy, the agent derives an estimate from activity type, duration, distance, and body weight. The diary's nutrition target is not silently changed by this estimate.

## 8. Data ownership and backups

- Mobile data is local-first and versioned through migrations.
- Sync mutations use an ordered offline queue and stable IDs.
- Agent exports include nutrition, weight, plans, and activity records, but not integration secrets.
- Deleted records sync as explicit mutations rather than reappearing on the next pull.
- Export JSON/CSV regularly and keep it with normal encrypted backups.

## 9. Acceptance checklist

1. Create a body profile and verify generated calorie/macro targets look plausible.
2. Add one custom food from a packet label and log multiple serving sizes.
3. Scan a barcode and confirm the selected product before logging.
4. Record a regional meal description and correct any uncertain portion before saving.
5. Create a meal plan, apply it, and remove one generated diary entry.
6. Log seven days of weight and inspect the rolling trend rather than one-day changes.
7. Disable Wi-Fi, add an entry, reconnect, and verify ordered sync.
8. Connect Strava, import recent activities, and check for duplicates after a second sync.
9. Export data and inspect that no pairing token, Strava secret, or raw audio is present.
10. Record UI and workflow feedback by screen, action, expected result, and actual result.

## Known external setup boundaries

The implementation is complete, but three optional features cannot become live without user-owned configuration: a running local transcription model, a logged-in Codex CLI with the resolver enabled, and Strava developer credentials. None is required for core diary, plan, weight, graph, or manual activity use.
