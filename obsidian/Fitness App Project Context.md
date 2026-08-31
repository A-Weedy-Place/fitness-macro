---
tags: [fitness-app, macronutrients, local-first, roadmap]
project: fitness-macro
updated: 2026-08-31
---

## Source of truth: standalone mobile product architecture - 2026-08-31

> This section supersedes the older PC-agent, LAN-pairing, Codex CLI, local-Whisper, and manual mobile-key notes below. Those sections are historical records, not the forward plan.

### Product definition

- **FitnessMacro is a standalone Android nutrition app.** The APK owns diary, cookbook, recipes, targets, plans, trends, profile, local lock, and portable backup. Core features must not need a PC.
- The app has internet. AI features are online, but normal local features remain usable offline.
- Do not package Whisper, an LLM, Codex CLI, or any large model on the phone. Do not ask the user to enter an AI API key.
- Use Groq `whisper-large-v3-turbo` for STT and `openai/gpt-oss-120b` for confirmation-gated food-agent plans. The mobile app sends compact relevant local context and applies approved actions to its own database.

### Required production connection

```text
FitnessMacro APK → private hosted FitnessMacro relay → Groq API
                                      └→ server-side GROQ_API_KEY secret
```

- No PC hop, LAN pairing, desktop process, PC IP, Codex CLI, or desktop dependency in the target product.
- Never embed, obfuscate, or hash a usable Groq key into the APK. A hash cannot call Groq; a bundled secret can be extracted. The private relay keeps the key server-side, as normal consumer apps do.
- The no-cost Cloudflare Worker is deployed at `https://fitness-macro-relay.fitness-macro-relay.workers.dev`. `GROQ_API_KEY` and `APP_ACCESS_TOKEN` are encrypted Worker secrets; neither is in Git or the APK. The Worker relays only required AI requests and Open Food Facts lookups, and stores no diary, profile, recipe, or raw-audio data.
- Cloudflare Workers Free currently allows 100,000 requests/day with 10 ms CPU per request. Groq Free currently lists GPT-OSS 120B at 30 RPM, 1,000 RPD, 8,000 TPM, and 200,000 TPD; Whisper Turbo is listed at 20 RPM, 2,000 RPD, 7,200 audio seconds/hour, and 28,800 seconds/day. Sources: [Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), and [Groq rate limits](https://console.groq.com/docs/rate-limits).
- The preview APK has a separate rotatable relay access token. It is not the Groq key, but it is extractable from an APK and is only an owner-test safeguard. Proper account/device authentication and durable global rate limits are required before public distribution.

### Required delivery rhythm

1. One short isolated change stage.
2. Update this note and `context.md`.
3. Test, commit, and push.
4. Build an installable APK.
5. Owner tests with a short checklist before the next unrelated change.

### Migration state

- The old Express `agent/` source, PC sync queue, LAN pairing/token settings, PC link form, Codex CLI route, local Whisper/Python service, provider switching, and PC Strava OAuth path are removed. Former agent data remains ignored only as a local archive and is not used at runtime.
- `mobile/src/services/agentClient.ts` now calls the Worker directly. Mobile state is schema **7** with no remote sync queue.
- `relay/` is the only server-side runtime and is source-controlled without secrets. It provides goal programs, typed action plans, food phrase resolution, Whisper transcription, Open Food Facts search, and barcode lookup.

### Standalone relay validation — 2026-08-31

- **You → Connections** shows hosted Voice assistant/Food agent status with no PC-link form, Wi-Fi address, pairing token, or user API-key entry. Health Connect remains optional and free; Strava is a later secure-hosted stage.
- Android clear-text traffic is disabled because AI/reference traffic uses HTTPS. The Worker gives the app a 60-request/hour per-warm-isolate cap, a 6,000-character local context ceiling, and a 1,000-token GPT-OSS response cap.
- Validation: relay TypeScript, mobile TypeScript, and 12 local tests pass. Live Worker goal-program and typed-action calls succeeded. A third immediate structured call hit Groq’s expected free-tier `429`; normal personal use should avoid rapid bursts.

## APK feedback correction stage — 2026-08-31

- Physical-phone testing confirmed that the direct Groq relay is live, but also exposed product issues that Expo Go did not prove. This stage fixes those behaviors before the next preview APK.
- **Calendar/clock:** default diary dates follow the phone clock instead of UTC. **You → Date & time** stores either Device time or a valid IANA override (including `Asia/Karachi`). Today always shows Monday–Sunday; arrows move by a whole week.
- **Manual food control:** catalogue failure cannot block local cookbook/reference search. Tap a logged diary item to edit only that item’s amount, unit, note, date, or time. Custom food and dish builder remain available without AI.
- **Adaptive plan:** after 14 calendar dates, 10 food-log days, and weights across the interval, observed maintenance may update no more than weekly, at ≤100 kcal/day per step. Missing data never lowers targets. Method details are collapsible.
- **Account panels:** account Goal plan and Progress panels no longer jump to the main tab bar. Themes use production-safe `expo-updates` restart. Health Connect now declares its three read permissions, reads all allowed Health Connect origins, and shows an explicit result dialog.
- The stale ignored mobile `.env` containing an old PC URL/pairing token was deleted. There is no mobile PC runtime path.
- Validation: `npm run typecheck`, **13/13** mobile tests (including local-calendar/Monday-week coverage), Android config permission inspection, SDK-compatible `expo-updates`, and `git diff --check` pass. Canonical preview build `2748e908-771b-4f73-aad9-1e3145942d29` from `41bfd42` finished successfully: `https://expo.dev/artifacts/eas/-dvLRhIbi5kZhkZ6dfmIysGT9MJq-RO7JDu2EVf8jJs.apk` (expires 2026-09-14). Its accidental duplicate has the same artifact fingerprint.

## Account and Android UI checkpoint - 2026-08-31

- Keep this note and `context.md` synchronized after every material product decision or completed feature.
- Android navigation must start hidden so it cannot overlay the in-app bottom tabs; the normal bottom-edge swipe is the intentional way to reveal it temporarily.
- Bottom navigation is now icon-led (Today, Goals, AI, Trends, Food, You) with compact text labels retained for clarity/accessibility.
- **You** is a compact account hub with separate Profile & measurements, Goals & daily plan, Progress & statistics, Appearance & display, Connections, Local app lock, and Backup/restore/sync panels rather than one long form.
- A chosen profile image is saved as a local device URI. It is not yet a cloud avatar and may need reselecting after moving devices.
- Current login scope is deliberately local and free: an optional 4–8 digit PIN in encrypted Expo SecureStore locks the app after backgrounding. It has no cloud identity, email/Google sign-in, recovery, or cross-device behavior. A real account requires a future authenticated backend.
- Themes: Warm Harvest, Clean Neutral, Charcoal, Coastal Blue, and Orchid Dusk. The app follows device brightness rather than changing it.
- New Expo native dependencies/config cover system navigation-bar hiding, local photo selection, and encrypted PIN storage. Rebuild the APK to test native behavior realistically; Expo Go remains useful for UI iteration.
- There is no PC link, saved Wi-Fi address, pairing token, or desktop agent in the shipped mobile path. The preview APK reaches only the private HTTPS relay.
- Verification: mobile type-check + 12 tests and agent build + 8 tests pass.

## Phone-test product specification checkpoint - 2026-08-30

- Keep this note and `context.md` synchronized after material product decisions and completed work.
- Profile/onboarding data must drive a personalized nutrition program. Health Connect is a free Android data bridge for weight/activity records, while deterministic bounded calculations own target numbers and Groq personalizes/explains meals and operates typed actions.
- The assistant must control food logging at explicit times, time corrections, deletion, recipe creation/editing/reuse, separate one-off modifiers such as extra oil, daily weight, and later exercise/Strava.
- Library UX must separate recently eaten foods, the user's personal cookbook, and a broader reference catalog, with strong Pakistani, Indian, South Asian, and Southeast Asian coverage.
- Resolution order is reviewed saved recipe, trustworthy reference evidence, then conservative confirmation-gated Groq ingredient decomposition. Reviewed recipes are reused without repeated research; model estimates never silently overwrite cookbook nutrition.
- Store at most one canonical weight record per local calendar day; a second value updates that day.
- Prefer installable APK builds for realistic performance and native Health Connect tests; retain Expo Go for quick iteration.

### Implemented from this checkpoint

- Mobile state is now schema **6** (migration from 5). It saves the personalized nutrition program and keeps only the latest weight record for every calendar day. The PC agent remains schema 5 but applies the same daily-weight rule.
- Onboarding captures eating style, preferred food familiarity (Pakistani/Indian/South Asian/Southeast Asian), meals per day, and optional foods to avoid. Groq returns a flexible meal structure, while local Mifflin-St Jeor/TDEE calculations remain the locked source of calorie and macro targets.
- Goals persist the sample day, per-meal target allocations, actions/cautions, and WHO, ICMR-NIN 2024, and Dietary Guidelines source links. The local plan remains available if Groq is unavailable.
- Health Connect is free, permission-scoped Android import for daily weight and Strava calories. A manual in-app check-in wins for the same day. Native Health Connect requires the custom APK/development build, not Expo Go.
- The Food tab now shows true Recent foods, My cookbook, and Reference catalog separately; recipes show Personal recipe vs AI estimate provenance. An AI estimate never overwrites saved cookbook nutrition.
- `docs/food-data-strategy.md` documents free/attributed sources: local/USDA first, IFCT 2017 planned for South Asian ingredients, and RecipeDB excluded for its non-commercial licence.
- `mobile/eas.json` defines EAS development and installable preview APK profiles. Android LAN HTTP is enabled intentionally for the paired PC agent.
- Expo project linked as `@a-weedy-place/fitness-macro` (project ID `714cf37d-459a-4408-b025-1334f0bfc779`). Preview APK build `19f9ec60-9684-4a18-b68d-d589b5768dd0` was submitted on 2026-08-30 and was still `IN_PROGRESS` at the last check; use the EAS build list command in `mobile/` to retrieve its artifact when complete.
- Live agent test produced a Pakistani three-meal structure while holding the local target at 2,147 kcal / 148 g protein. Mobile type-check + 12 tests and agent build + 8 tests pass.

## Free Groq and efficient-agent checkpoint - 2026-08-30

- New development constraint: speech and reasoning must require no additional subscription or API payment.
- Groq Free is the only AI runtime provider for Whisper transcription and GPT-OSS food planning. The former Codex CLI process, fallback, goal-advisor, provider-selection, settings, and status code has been removed.
- The unused local Faster-Whisper/Python service and alternate transcription modes were also removed. The private `GROQ_API_KEY` now directly powers the fixed `whisper-large-v3-turbo` endpoint.
- The agent now compacts the mobile snapshot to relevant local foods, recipes, and diary records before inference instead of transmitting the full history.
- Token controls include a context ceiling, low reasoning effort, output cap, stable cacheable prompts, and logged usage.
- Paid hosted web-search tools are disabled. Broader recipe search, if needed, should use optional self-hosted SearXNG.
- Exact Windows setup is in `docs/free-groq-agent-setup.md`.
- Live Windows validation passed for Groq Whisper and GPT-OSS. Saved food nutrition now overrides model arithmetic, all mutations force confirmation, and the aloo-keema plus extra-oil scenario remained two separate log components.


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

- Offline food coverage now includes more than 70 common and South Asian foods/ingredients; milk works without the PC agent.
- Online source order is local cache -> Open Food Facts for packets/barcodes -> USDA FoodData Central for generic ingredients -> optional confirmed Codex suggestions.
- The profile opens in read mode with goals and a 365-day progress summary; editing is an explicit action.
- Free local multilingual Faster Whisper is packaged under `agent/voice`; use `npm run voice:setup` once and `npm run dev:full` normally.
- Strava code is complete but activation requires account-owned API credentials and, under current Strava policy, a subscription-created API app.
- See `docs/food-data-strategy.md` for dataset decisions and source policy.

## Ingredient and voice completion pass - 2026-08-07

- USDA SR Legacy is now locally indexable and searched before network results, giving the recipe builder thousands of generic ingredient records.
- All food surfaces derive a category emoji, including remote and custom records.
- Quantity controls support g/kg/ml/cup/tbsp/tsp/piece/slice/bowl/plate/serving with gram-normalized nutrition math.
- Recipe AI returns separate ingredients; each ingredient stays editable and can be replaced through local index search.
- Shared UI is denser and long text wraps/shrinks inside cards and controls.
- Voice uses actual microphone metering, a silent flatline, an explicit processing spinner, and persistent error feedback.
- Strava credentials remain an account-owner action; OAuth/import code is already implemented.

## Progressive logging redesign - 2026-08-07

- Android audio now uploads with Expo File and expo/fetch rather than the unreliable file-URI Blob conversion.
- Today uses a clean week strip, target bars, current-time logging, and a condensed event timeline.
- Food search and quick logging show compact rows and direct add controls; advanced quantity controls are disclosed only when editing.
- Food/dish detail shows selected-portion macros and complete per-ingredient recipe nutrition.
- Body/activity/sync controls are collapsed until requested.
