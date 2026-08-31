# context.md

## Source of truth: standalone mobile product architecture - 2026-08-31

This section supersedes older PC-agent, LAN-pairing, Codex CLI, local-Whisper, and manual-mobile-key notes below. Older sections are historical implementation records only.

### Product definition

- **FitnessMacro is a standalone Android nutrition app.** The installed APK owns the user's diary, cookbook, recipes, targets, plans, trends, profile, local app lock, and portable backup. These normal features must work without a PC.
- The app has internet access. AI features are online by design; the app must remain useful if the internet is unavailable.
- The user does **not** want Whisper, an LLM, Codex CLI, or another large model packaged on the phone. The app must not ask the user to paste an AI API key.
- The product uses two Groq-hosted models: `whisper-large-v3-turbo` for speech-to-text and `openai/gpt-oss-120b` for typed food-agent reasoning. The agent reads compact relevant local context, returns confirmation-gated actions, and the mobile app itself applies approved changes to its local database.

### Required production connection

```text
FitnessMacro APK → private hosted FitnessMacro relay → Groq API
                                      └→ server-side GROQ_API_KEY secret
```

- There is no PC hop, PC IP address, LAN pairing token, local background agent, Codex CLI, or desktop dependency in the target architecture.
- The Groq key must never be embedded, encoded, obfuscated, or hashed inside the APK: a hash cannot call Groq, and any usable embedded secret can be extracted. Normal consumer apps solve this by keeping the key only on their backend.
- The no-cost Cloudflare Worker is deployed at `https://fitness-macro-relay.fitness-macro-relay.workers.dev`. `GROQ_API_KEY` and `APP_ACCESS_TOKEN` are encrypted Worker secrets; neither is in Git or the APK. The Worker only relays required AI requests and Open Food Facts lookups. It stores no diary, profile, recipe, or raw-audio data.
- Cloudflare Workers Free currently allows 100,000 requests/day with 10 ms CPU per request. Groq Free currently lists `openai/gpt-oss-120b` at 30 RPM, 1,000 RPD, 8,000 TPM, and 200,000 TPD; Whisper Turbo is listed at 20 RPM, 2,000 RPD, 7,200 audio seconds/hour, and 28,800 seconds/day. Official sources: [Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), and [Groq rate limits](https://console.groq.com/docs/rate-limits).
- The private Worker has a 60-request/hour per-warm-isolate cap. The app sends a maximum 6,000-character compact local context and asks GPT-OSS for at most 1,000 completion tokens. A fast burst of several independent structured requests can still hit Groq’s 8K TPM ceiling; local logging remains usable and the app tells the owner to retry later.
- A preview APK contains a separate rotatable relay access token from EAS. It is not the Groq key, but it is extractable from an APK and therefore is only an owner-test safeguard. Proper account/device authentication and durable global rate limits are required before public distribution.

### Delivery process required by the owner

1. Work on one short, isolated stage only.
2. Update this file and `obsidian/Fitness App Project Context.md` with the resulting decision and validation.
3. Run proportionate tests, commit, and push to GitHub.
4. Produce a new installable APK for that stage.
5. Give the owner a short test checklist and wait for feedback before starting the next unrelated stage.

### Migration state

- The old Express `agent/` source, PC sync queue, LAN pairing/token settings, PC link form, Codex CLI route, local Whisper/Python service, provider switching, and PC Strava OAuth path are removed. Former agent data remains ignored only as a local archival copy and is not used at runtime.
- `mobile/src/services/agentClient.ts` now calls the Worker directly. Local state is schema **7** and has no remote-operation queue or last-synced timestamp.
- `relay/` is the only server-side runtime and is source-controlled without secrets. It provides goal programs, typed action plans, food phrase resolution, Whisper transcription, Open Food Facts search, and barcode lookup.

### Standalone relay validation — 2026-08-31

- **You → Connections** now shows hosted Voice assistant/Food agent status with no PC-link form, Wi-Fi address, pairing token, or user API-key entry. Health Connect remains an optional free Android-native integration; Strava is deliberately a later secure-hosted stage.
- Android clear-text traffic is disabled because AI/reference requests use HTTPS.
- Validation: Worker TypeScript passes; mobile TypeScript and 12 mobile tests pass. Live Worker goal-program and typed-action calls succeeded. A third immediate structured call received Groq’s expected free-tier `429`, confirming that this personal free tier should not be burst-tested.

## APK feedback correction stage — 2026-08-31

- The owner tested the first standalone APK on a physical phone. The direct Groq relay is working (typed AI responds), but the release exposed several real product issues; this stage corrects the behavior rather than treating Expo Go as final proof.
- **Calendar and clock:** diary dates now default to the phone’s local calendar instead of UTC; a selectable IANA time-zone override lives in **You → Date & time**. Today shows one full Monday–Sunday week, and its arrows move by whole weeks.
- **Manual-first food logging:** a successful or failed online catalogue lookup never blocks the on-device cookbook/reference search. Every logged row now opens an individual editor for its amount, unit, note, date, and time; editing a log never changes the reusable food/recipe. The manual Custom food and Build a dish paths are visible beside search.
- **Adaptive goals:** after 14 calendar days, at least 10 logged food days, and weigh-ins across the period, a local observed-maintenance estimate can update automatically at most once a week, with a maximum 100 kcal/day step. Missing logs never lower a target. The detailed calculation is collapsible; the normal Goals view is concise.
- **Account separation:** Goals & daily plan and Progress & statistics in **You** are account panels, not shortcuts into bottom-tab screens. The main Goals and Trends tabs remain separate product views.
- **Themes:** release builds use `expo-updates` to restart safely after a palette selection; the former development-only reload path was the reason appearance choices appeared to do nothing in the APK.
- **Health Connect:** the Android manifest now declares only `READ_WEIGHT`, `READ_ACTIVE_CALORIES_BURNED`, and `READ_TOTAL_CALORIES_BURNED`; the app requests them at runtime, no longer filters records to Strava, and shows the connection result in a dialog. It still requires Android Health Connect support and a device screen lock. It is free and never uses an API key.
- Deleted the obsolete ignored mobile `.env` that contained a previous PC address/pairing token. No mobile runtime reads any PC URL or pairing variable.
- Validation before the replacement preview build: `npm run typecheck` passes, **13/13** mobile tests pass (including local-calendar and Monday-week coverage), `expo config` resolves the three Health Connect permissions, `expo-updates` is installed at the Expo SDK-compatible version, and `git diff --check` passes. Preview build `2748e908-771b-4f73-aad9-1e3145942d29` is the intended build from commit `41bfd42`; an accidental duplicate queued build should be ignored/cancelled if EAS exposes it.

## Account and Android UI checkpoint - 2026-08-31

- Keep this section synchronized with `obsidian/Fitness App Project Context.md` whenever the user makes a material product decision or a feature is completed.
- Android's system navigation bar must start hidden so it cannot cover FitnessMacro's fixed bottom tab bar. Android's normal bottom-edge swipe remains the deliberate way to reveal it temporarily.
- The app now uses icon-led bottom navigation: Today, Goals, AI, Trends, Food, and You. Text labels remain below the icons for clarity and accessibility.
- **You** is now a compact account hub rather than a long single form. Its panels separate Profile & measurements, Goals & daily plan, Progress & statistics, Appearance & display, Connections, Local app lock, and Backup/restore/sync.
- A profile picture can be picked from the phone's library and is stored as a local URI in the local-first profile record. It is useful on the current device; it is not yet a cloud-synced avatar and may need selecting again after moving to a new phone.
- Optional login for the current local-first product is a device-only 4–8 digit PIN, stored in encrypted Expo SecureStore. It locks on backgrounding and has no subscription, server, email identity, password recovery, or cross-device account semantics. A real email/Google account must be designed with an authenticated backend later; do not imply that this PIN is one.
- Appearance now offers Warm Harvest, Clean Neutral, Charcoal, Coastal Blue, and Orchid Dusk. Brightness intentionally follows the phone's own system controls.
- Added native Expo dependencies/config for Android navigation-bar control, profile photo picking, and encrypted local PIN storage. These native additions need a rebuilt APK for full realistic testing, though most layout work can still be inspected in Expo Go.
- There is no PC link, saved Wi-Fi address, pairing token, or desktop agent in the shipped mobile path. The preview APK reaches only the private HTTPS relay.
- Validation after this UI checkpoint: mobile TypeScript check + 12 tests pass; agent build + 8 tests pass.

## Phone-test product specification checkpoint - 2026-08-30

- Keep this file and `obsidian/Fitness App Project Context.md` updated after material product decisions and completed work so future sessions inherit the real state.
- Onboarding/profile information must drive a personalized nutrition program. Health Connect may contribute free Android weight/activity records, but planning numbers must remain deterministic and evidence-based; Groq may personalize meals, explain the plan, and operate typed actions without silently rewriting safety-bounded targets.
- The assistant is intended to control the complete food workflow: log food at an explicit time/date, correct entry time, delete entries, create/edit cookbook recipes, reuse saved recipes, log one-off modifiers separately, log weight, and later incorporate exercise/Strava.
- Cookbook/library UX should distinguish recently eaten foods, the user's personal recipes, and a broader reference catalog. Regional coverage must prioritize Pakistani, Indian, South Asian, and Southeast Asian dish names and ingredients.
- Food resolution order: relevant saved/AI-reviewed recipe first; otherwise trustworthy reference/catalog evidence; otherwise a conservative Groq-proposed ingredient recipe that requires confirmation. A one-off modifier such as extra oil must be a separate diary item and must not mutate the base recipe.
- A newly researched recipe stores decomposed ingredients and normalized macros plus provenance/review status. Once a recipe is reviewed, ordinary reuse should not repeat external research. Existing cookbook nutrition must never be overwritten merely because a model estimate differs; updates require an explicit reviewed action and confirmation.
- Weight logging is one canonical record per local calendar day; another same-day log updates/replaces that record rather than creating duplicates.
- Expo Go remains useful for quick UI iteration, but installable Android APK builds are preferred for realistic performance and native Health Connect testing.

### Implemented from this checkpoint

- Mobile state migrated safely from schema 5 to **schema 6**. It persists the personalized nutrition program and deduplicates every historical weight date to its latest record. The PC agent store remains schema 5 but applies the same one-weight-per-date invariant.
- Onboarding now captures eating style, familiar cuisine (including Pakistani/Indian/South Asian/Southeast Asian), meals per day, and optional foods to avoid. It requests a Groq-generated flexible example day, while the local Mifflin-St Jeor/TDEE calculation remains the locked source of daily calorie and macro targets.
- The Goals screen persists the returned meal structure, its deterministic per-meal calorie/protein allocations, practical actions/cautions, and visible WHO, ICMR-NIN 2024, and Dietary Guidelines sources. A PC-agent outage falls back to the local plan without changing targets.
- Health Connect is integrated as a free, permission-scoped Android import for weight and Strava calorie records. Imported weights are deduplicated by date, and a deliberate in-app check-in wins over an import for that day. It requires the native APK/development build, not Expo Go.
- The Food screen now uses true most-recently-eaten ordering and distinct **Recent**, **My cookbook**, and **Reference catalog** sections. Food/recipe provenance is shown as Personal recipe, AI estimate, or a reference source; AI-generated recipes are never called approved unless a future explicitly attributed review is stored.
- `docs/food-data-strategy.md` records the no-cost data and licence strategy. USDA/local ingredient data remain the primary facts; IFCT 2017 is the planned South Asian ingredient expansion; RecipeDB is excluded because its non-commercial licence is unsuitable for a future product.
- `mobile/eas.json` now provides free EAS `development` and installable `preview` APK profiles. Android clear-text LAN traffic is explicitly enabled because the app intentionally talks to the paired PC agent over local Wi-Fi.
- Expo project created and linked as `@a-weedy-place/fitness-macro` (project ID `714cf37d-459a-4408-b025-1334f0bfc779`). Preview APK build `19f9ec60-9684-4a18-b68d-d589b5768dd0` was submitted on 2026-08-30 and was still `IN_PROGRESS` at the last check; retrieve it with `cd mobile && npm exec --yes --package=eas-cli -- eas build:list --platform android --limit 1` after it completes.
- Live agent validation succeeded after this change: the goal endpoint returned a 3-meal Pakistani structure with a locked 2,147 kcal / 148 g protein target. Mobile type-check + 12 tests and agent build + 8 tests pass.

## Free Groq provider and token-budget checkpoint - 2026-08-30

- Zero required spend is a hard product constraint. The recommended development path keeps the Groq account on its Free plan without a payment method.
- Simplified the runtime to one AI provider: Groq handles Whisper transcription and GPT-OSS planning. All former Codex CLI spawning, provider selection, fallback, goal-advisor code, settings, and status aliases were removed; deterministic nutrition lookup remains the non-AI fallback.
- Removed the unused local Faster-Whisper/Python service, alternate transcription modes, and combined startup scripts. `GROQ_API_KEY` is now the only AI credential and directly powers the fixed `whisper-large-v3-turbo` transcription endpoint.
- Groq Whisper Large V3 Turbo can use the same private server-side key as the GPT-OSS reasoning model. The key must never enter an `EXPO_PUBLIC_*` variable.
- Added compact local retrieval before inference: current-day entries plus a few relevant historical entries, top matching recipes/foods, a hard context-character budget, low reasoning effort, capped output, and terminal token-usage reporting.
- Paid Groq Compound/web/browser-search tools are deliberately excluded. Existing local foods, USDA index/API, and Open Food Facts remain the no-cost nutrition path.
- A future broad web-recipe fallback should be optional self-hosted SearXNG. Until then, missing-recipe estimates remain conservative and confirmation-gated.
- Vercel AI SDK, Mastra, and LangGraph.js were evaluated. A small auditable provider layer is sufficient now; Vercel AI SDK is the leading future option if the tool loop becomes materially more complex.
- Windows setup and free-plan safeguards are documented in `docs/free-groq-agent-setup.md`.
- Live validation on the Windows PC passed: Groq Whisper transcribed a temporary WAV exactly and reported `retained: false`; GPT-OSS produced confirmation-gated plans for paratha plus eggs and for an existing aloo-keema recipe plus three separate tablespoons of oil.
- The live tests exposed and fixed two trust-boundary issues: mutation plans now force confirmation regardless of model output, and saved cookbook nutrition deterministically overrides model-recalculated values.
- Representative reasoning calls used 1,211-1,293 input tokens and 535-717 output tokens, remaining comfortably within the current personal-use free limits.

## Current decisions
- Stack selected: React Native (Expo) with local-first architecture + local PC agent service for enrichment.
- Mobile runtime baseline: Expo SDK 57, React Native 0.86, and React 19.2.
- Local persistence: AsyncStorage-backed typed store in-app (for MVP) and agent-side atomic JSON DB with versioned migrations.
- Nutrition sources: local food library first, optional remote fallback via Open Food Facts and USDA FoodData Central.
- Strava integration: deferred to phase-2/after-phase-1 stabilization.
- Voice/LLM: on-device capture sent through the paired PC agent to Groq Whisper, followed by Groq GPT-OSS planning.
- No paid dependency required for food search/barcode for baseline.

## Unresolved risks
- API variability by region remains the largest quality risk for non-US packaged foods.
- Offline speech pipeline requires model/runtime setup outside app install.
- Barcode + food-name parsing confidence scoring needs conservative defaults to avoid wrong entries.
- Obsidian note path and sync cadence depend on your local vault location.
- Expo SDK 57 currently carries a moderate transitive `uuid` advisory in native configuration tooling; npm offers no non-breaking remediation. The previous high/critical Expo 52 advisories were removed by the SDK upgrade.

## Data sources
- Local sources:
  - `food_items` created manually by user.
  - `recipes` composed from local food components.
- PC agent sources:
  - Open Food Facts barcode/product endpoint (no key required).
  - USDA FoodData Central search + details endpoint when key is configured.
- Weight/metrics:
  - Manual daily weight and body-metric entries are first-class and highest trust by default.

## Scope-of-trust
- App data remains on-device by default.
- Agent endpoints are only called for optional enrichment and cache misses.
- Agent runs on local PC. Pairing token is mandatory for API access.

## Schema changes
- Mobile app state: schema `6`; PC agent JSON store: schema `5`.
- Migration tracked in `agent/src/storage/db.ts` and applied on startup.
- Core entities:
  - `UserProfile`
  - `BodyMetricLog`
  - `FoodItem`
  - `FoodPortion`
  - `Recipe`
  - `MealEntry`
  - `ActivityEntry`
  - `DailyGoal`
  - `SyncEvent`
  - `AuditLog`
  - `AgentJob`

## Manual sync notes
- App only syncs in pull mode from agent by default.
- Merge policy:
  - Manual entries on app win over remote/agent imports for same date+meal+source stamp.
- Export and delete flows are local exports of the entire store to JSON/CSV (no server lock-in).

## Architecture added
- Added PC agent service at `agent/`:
  - `/v1/foods/search`
  - `/v1/foods/barcode/:code`
  - `/v1/foods/resolve`
  - `/v1/weights`
  - `/v1/entries`
  - `/v1/export`
- Added Expo app scaffold at `mobile/`:
  - typed core models
  - local AsyncStorage-backed store with v2-to-v3 migration
  - ordered offline replay queue using client-generated idempotency IDs
  - custom foods, phrase resolve, barcode lookup, profile targets, weight trend, and manual activities
- Added docs scaffolding:
  - `docs/open-source-inspiration.md`
  - `docs/phase-roadmap.md`
  - `docs/api-contract.md`
  - `docs/strava-integration-options.md`
  - `docs/voice-agent-architecture.md`
- Added local-only plan tracking and notes for continuous iteration in this file.

## Open questions / follow-up
- Strava OAuth client registration details (client id/secret) and whether to include webhooks or polling first.
- Decide whether to migrate from JSON store to SQLite before first external pilot.
- Decide audio/transcript encryption-at-rest strategy.
- Decide whether to host OpenAI-compatible local LLM locally or call a remote model for voice extraction.

## Weekly sync checkpoint
- **Date**: 2026-08-07
- **Status**: Scaffold and implementation baseline in repository.
- **Notes**:
  - Phase 1 local-first MVP flows implemented.
  - Nutrition storage standardized per 100 g; portions convert through grams-per-unit.
  - Agent expanded to profile, goals, custom foods, manual activities, and Open Food Facts text search.
  - Manual activity entry provides a usable bridge for Strava metrics before OAuth is added.
  - Mobile and agent TypeScript checks pass; agent auth boundary was smoke-tested over HTTP.
  - Expo SDK 57 dependency alignment passes its local compatibility check.
  - Mobile UI is now organized into Today, Plans, Trends, Food, and You tabs.
  - Added reusable day-based food plans and synchronized deletion for entries, weights, activities, and plans.
  - Added calorie/target bars, weight and rolling-trend line graph, macro donut, consistency grid, meal distribution, streak, adherence, protein-hit, activity, and weight-change metrics.
  - Added eight passing automated tests across nutrition, TDEE, analytics, plans, validation, migration, and deletion behavior.
  - Current Android production export bundles successfully through Metro/Hermes (718 modules).

## Implementation checkpoint - 2026-08-07

- Product state: runnable local-first Expo mobile app plus authenticated PC agent, schema version 4.
- Mobile navigation: Today, Plans, Trends, Food, and You with a cream/pine/coral visual system, responsive cards, intentional empty states, and custom bottom navigation.
- Daily logging: meal buckets, food portions, calories/macros, custom packaged foods, quick add, deletion, local library, remote-source fallback, and ordered offline synchronization.
- Planning: reusable meal plans can be assembled from library foods and applied as normal editable diary entries.
- Weight and targets: profile-driven Mifflin-St Jeor BMR/TDEE targets, weight logs, weekly/rolling trends, stable target presentation, and user-controlled activity estimates.
- Analytics: calorie-versus-target bars, rolling weight line, macro donut, consistency grid, streak, adherence, protein hit rate, averages, meal distribution, activity duration, and weight change.
- Capture: Expo camera barcode scanner, manual barcode fallback, Expo audio recorder, transcript confirmation, and suggested spoken-quantity preservation.
- Local transcription: memory-only agent forwarding supports OpenAI-compatible endpoints and whisper.cpp `/inference`; 25 MB upload limit and no raw-audio persistence.
- Food intelligence: deterministic local/Open Food Facts/USDA path plus an optional read-only Codex CLI resolver with schema-constrained output, one-job concurrency, timeout, source URLs, confidence, and deterministic fallback.
- Strava: OAuth state protection, rotating refresh-token handling, separate non-exported secret store, paginated recent-activity import, stable-ID deduplication, calorie fallback estimates, and mobile connect/sync controls.
- Security boundary: pairing token required for agent APIs; OAuth callback guarded by expiring state; Strava secrets excluded from app exports and version control. Plain local HTTP must not be exposed directly to the internet.
- Configuration reference: `agent/.env.example`; complete setup and acceptance workflow: `docs/complete-local-setup.md`.
- Automated coverage: 10 focused tests across mobile and agent suites, including nutrition math, portions, targets, trends, plans, migrations, deletion, activity energy, and Codex status behavior.
- External activation still owned by the user: run a local transcription server, opt in to the logged-in Codex CLI resolver, and provide Strava developer credentials. Core diary, plans, custom foods, weight, charts, and manual activity remain independent of all three.

### Weekly Obsidian checkpoint

- Review source confidence for newly saved regional foods and packet products.
- Export a backup and record any schema changes before the next feature cycle.
- Collect phone feedback by screen, action, expected behavior, and actual behavior.
- Reassess activity-calorie assumptions only from longer-term weight/intake trends, not single activities.

### Validation checkpoint - 2026-08-07

- Mobile automated suite: 5/5 tests passed.
- Agent automated suite: 5/5 tests passed.
- Mobile TypeScript no-emit check passed.
- Agent TypeScript build check passed.
- Expo dependency compatibility check reports dependencies up to date (performed offline).
- Android production export passed: 736 Metro modules and a 1.8 MB Hermes bundle at `/tmp/fitness-macro-export-complete`.
- Runtime API smoke passed for `/health`, `/v1/audio/status`, `/v1/agent/status`, and `/v1/integrations/strava/status` using the authenticated `x-agent-token` contract.
- Optional integrations correctly report `configured: false` in a clean environment instead of breaking the core app.

## Phone feedback iteration - 2026-08-07

- Schema advanced to version 5; existing schema-4 profiles migrate as completed accounts and old meal buckets receive sensible default times.
- Added mandatory first-run onboarding for local account name, age, BMR sex input, height, current weight, activity level, body goal, target weight/date, and gentle/moderate/aggressive pace.
- Goal rates are derived from the target deadline and capped by body weight; calorie adjustment remains capped at 30% of estimated TDEE. Codex may explain the calculated plan but cannot alter its numbers.
- Reframed Plans as Goals. The screen now leads with body direction, target date, pace, calorie/macro targets, maintenance estimate, and optional Codex review; reusable food-day templates remain below.
- Replaced meal-card-first diary presentation with a full midnight-to-midnight food timeline. Every food entry stores `eatenAt`; templates preserve time; old entries migrate to meal-based fallback times.
- Daily energy now displays eaten, activity burn, and net energy while keeping exercise separate from the food target.
- Weight check-ins remain optional and trend graphs plot only actual check-in dates.
- Trend controls now support 1 week, 1 month, 1 year, and all time. Long-range bars support dense data without minimum-width overlap.
- Added 60 days of idempotent demo history covering foods, sparse weigh-ins, activities, and goals. It is selectable during onboarding or from You.
- Added a starter local library emphasizing Pakistani/South Asian foods: thin whole-wheat chapati, tandoori roti, paratha, daal, chicken karahi, chicken biryani, basmati rice, doodh patti, and common staples.
- Barcode logging now has an AI/search fallback on database misses, explicit whole-package gram conversion, exact grams/calories preview, and a 4/4/9 macro-versus-label mismatch warning. AI never silently overrides package math.
- Voice flow remains record -> local memory-only transcription -> structured resolver -> quantity/time confirmation -> local library. Typed transcript remains the fallback when local Whisper is unavailable.
- Added portable JSON account backup/restore through the native share sheet and paste-based import. Pending sync operations, pairing credentials, Strava secrets, and audio are excluded.
- Added a schema-constrained Codex goal advisor endpoint with deterministic fallback and explicit no-diagnosis/no-number-rewrite rules.
- Added the missing agent `npm run dev` command and a git-ignored mobile `.env` for the current LAN test address.
- Validation: mobile typecheck passed, agent build passed, mobile and agent automated suites passed, and Android/Hermes export passed at 742 modules / 1.8 MB (`/tmp/fitness-macro-schema5`).

## Phone feedback iteration 2 - product-stage logging - 2026-08-07

- Onboarding and profile now support centimeters or feet/inches, kilograms or pounds, with canonical metric storage and tested round-trip conversion.
- Replaced typed target-date fields with an in-app month calendar and future-date selection.
- Removed the unexplained body-recomposition option from user-facing setup. Goal choices are Lose weight, Maintain weight, and Build weight / muscle.
- Removed manual meal-category selection from food logging. Breakfast/lunch/snack/dinner are inferred from `eatenAt` and used only for analytics.
- Tapping an hour now opens an in-place modal plate instead of navigating to the Food tab. Search, natural-language description, voice transcript, multiple staged foods, quantity editing, removal, total macros, and one-tap batch logging share the same surface.
- Voice success now displays the exact transcript and an editable drafted plate. Failure explicitly says local Whisper is not connected and keeps typed description available.
- Added reusable recipe/dish construction: AI ingredient draft, manual saved-food ingredients, editable quantities, serving count, optional final cooked weight, batch nutrition, per-serving nutrition, and saved recipe-backed food.
- Local search ranking now prioritizes exact/prefix matches, recipes, regional starter foods, local/custom foods, and common USDA records ahead of broad branded results.
- Manual activities now ask only for activity and duration. Energy is estimated from a tested MET table and latest body weight; imported Strava values remain the preferred source and are labeled separately.
- Replaced ambiguous cross icons with explicit Remove controls for food, weight, and activity records.
- Trends now display calorie percentages by automatically inferred breakfast, lunch, dinner, snack, and other timing categories.
- Profile no longer leads with calorie/macro tiles. It now centers identity, personal measurements, unit preferences, goal preferences, Strava/voice/Codex connections, backup/restore, and local sync.
- Goals now shows the explicit maintenance +/- adjustment = daily target formula and explains repeat-day templates separately from recipes.
- Added a bounded, confidence-weighted 28-day expenditure estimate derived from logged intake and weight direction. It requires at least 7 logged days and a 7-day weigh-in span, never adds individual exercise calories, and only becomes active after user acceptance.
- Product pattern research: MacroFactor's official docs confirm hour-tap logging, a staged/reviewable plate, Describe review before logging, ingredient-based recipes with servings/final cooked weight, and expenditure derived from intake plus trend weight rather than exercise-calorie eat-back.
- Validation: mobile TypeScript passed, agent TypeScript passed, 11/11 mobile checks passed, 5/5 agent checks passed, and the Android/Hermes export command completed for `/tmp/fitness-macro-product-pass2`.

## Food coverage, profile, voice, and Strava checkpoint - 2026-08-07

- Expanded the guaranteed offline catalog from 12 foods to more than 70 dishes and ingredients, including whole/low-fat/skim/buffalo milk, dairy, flours, grains, fats, vegetables, aromatics, meats, legumes, fruit, and additional South Asian staples.
- USDA FoodData Central now falls back to the documented low-limit `DEMO_KEY`, prioritizes generic Foundation/SR/FNDDS results over branded matches, and supports a private free key for normal limits. Open Food Facts remains the packet/barcode source.
- RecipeDB was evaluated for regional recipe breadth, but is not integrated until stable programmatic access and redistribution terms are confirmed. Recipe macros remain transparently calculated from selected ingredients.
- The You screen now presents account details, goal direction, target, recorded journey progress, and 365-day logging/intake/weight/activity metrics by default. Profile forms appear only after Edit profile is selected.
- Added a free local multilingual Faster Whisper service, one-time setup command, and combined voice+agent runtime. Audio is held only in memory/temporary request storage and deleted after transcription.
- Strava OAuth, refresh, activity import, deduplication, and estimates are implemented. Activation remains blocked only on user-owned Strava API client credentials; current Strava policy also requires a subscription to create an app.
- Local test configuration uses a matching private pairing token and does not invoke, log out, or modify the Codex CLI account.

## Ingredient index, portions, visuals, and voice UX - 2026-08-07

- Added a local index builder for the official USDA SR Legacy JSON archive. It provides thousands of generic ingredient records without consuming API limits and is searched before remote branded results.
- Recipe construction can search the full PC ingredient index, and Codex recipe requests explicitly return separate editable ingredients rather than one finished-dish estimate.
- Added deterministic category emojis for every local, USDA, Open Food Facts, custom, recipe, and AI food across library, quick logging, recipes, and diary rows.
- Added quantity entry in g, kg, ml, cup, tbsp, tsp, piece, slice, bowl, plate, or serving. Nutrition remains gram-normalized; approximate volume/common-container conversions are visibly labeled.
- Reduced shared typography, card padding, controls, and timeline sizing; long button, title, source, and food text now shrinks/wraps instead of leaving its container.
- Voice recording now uses microphone dB metering: silence is a flatline and speech drives the bars. Processing has an explicit spinner and failures remain visible.
- `npm run dev:full` is idempotent when both services are already healthy and reports stale partial services without raw port-binding stack traces.
- Strava code remains complete, but the API application and secret cannot be created by this project; they must be created by the Strava account owner.

## Progressive logging UX and Android voice upload - 2026-08-07

- Replaced Android `fetch(fileUri).blob()` recording upload with Expo SDK 57 `File` plus `expo/fetch`, including an explicit empty-file guard before network upload.
- Redesigned Today around a compact seven-day strip, four target bars, one Log food now action, and a condensed timeline containing only logged times.
- Logging no longer asks for time in the normal flow. The current time is captured when the logger opens; tapping an existing timeline time remains the deliberate backdate path.
- Rebuilt food discovery as a compact recent/results list with direct plus actions. Quantity and unit controls appear only after opening a food or tapping a selected plate item.
- Added a dedicated food/dish detail sheet with selected-portion calories/macros. Recipe dishes list every ingredient, ingredient quantity, calories, protein, fat, and carbs.
- Weight, activity, and synchronization controls are collapsed on Today until explicitly requested.
# 2026-08-07 - AI action planner and themes

- Voice transcription now feeds a structured Codex action planner rather than stopping at food candidates.
- Supported actions are logging resolved foods, creating a reusable ingredient-based dish and logging it, or asking one material clarification.
- AI-created dishes retain ingredients, per-ingredient quantities, confidence, calculated macros, and the source transcript.
- Search prioritizes the user's recipes and manual foods before common database results.
- Appearance themes are Warm Harvest (default/original direction), Clean Neutral, and Charcoal. Theme preference is stored locally on the phone.
# 2026-08-07 - Android integration decision

- Deprecated core SafeAreaView usage was migrated to react-native-safe-area-context and the New Architecture LayoutAnimation no-op opt-in was removed.
- Do not scrape Strava: Strava API Policy 5.5 explicitly prohibits automated scraping and extraction.
- Preferred calorie-only Android path is Strava -> Health Connect -> FitnessMacro, limited to calorie records written by Strava. This requires a development build rather than stock Expo Go.
- The existing personal Strava OAuth API path remains a free, rate-limited alternative in Single Player Mode.
# 2026-08-07 - AI-native control plane

- The AI assistant is a primary bottom-tab destination, not only a food resolver.
- The app exposes a typed capability snapshot and stable record IDs to a specialized local Codex app agent.
- Read-only questions execute without confirmation. All mutations are returned as explicit action plans and require one user confirmation.
- Supported writes cover foods, dishes, weights, activities, diary time/date changes, deletion, goals, profile patches, plans, and navigation.
- Health Connect is configured through react-native-health-connect. It reads only calorie records originating from com.strava, preferring ActiveCaloriesBurned and falling back to TotalCaloriesBurned without combining both.
- Health Connect sync runs when the Android app enters the foreground after one explicit permission grant. Expo Go remains usable for non-native screens; Health Connect needs the FitnessMacro development build.
