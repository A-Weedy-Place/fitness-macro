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

Keep the PC and phone on the same trusted network. In the mobile **You → Connections → PC agent link** form, set the URL to `http://YOUR_PC_LAN_IP:8787` and enter the same pairing token. The URL is stored locally and the token is stored in encrypted device storage, so an APK does not need rebuilding after the PC receives a new LAN IP. The status cards distinguish unavailable, configured, and connected services.

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

## 5. Groq voice transcription

The phone records speech-to-text audio and sends it to the paired PC agent. The agent forwards it directly to Groq's free-plan `whisper-large-v3-turbo` endpoint using the same private `GROQ_API_KEY` as the planner. There is no second voice server or local model to install.

Audio is uploaded only after recording stops. The agent enforces a 25 MB limit, keeps request bytes in memory, and does not save raw audio. The mobile recording remains temporary and can be discarded after transcription.

If Groq transcription is unavailable or its free limit is reached, barcode, typed search, custom food, and manual quick-add remain available.

## 6. Groq-assisted food resolution

Groq GPT-OSS receives only a compact selection of relevant saved foods, recipes, and diary entries. It proposes schema-validated actions, and the app requires confirmation before every write. Open Food Facts, the local USDA index, USDA's free endpoint, and manual entry remain available when the hosted model is unavailable or uncertain.

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

The hosted voice and planning path requires the user's Groq Free API key. Strava remains optional and requires user-owned developer credentials. Neither is required for core diary, plans, custom foods, weight, charts, or manual activity.
