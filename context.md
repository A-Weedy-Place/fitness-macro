# context.md

## Current decisions
- Stack selected: React Native (Expo) with local-first architecture + local PC agent service for enrichment.
- Mobile runtime baseline: Expo SDK 57, React Native 0.86, and React 19.2.
- Local persistence: AsyncStorage-backed typed store in-app (for MVP) and agent-side atomic JSON DB with versioned migrations.
- Nutrition sources: local food library first, optional remote fallback via Open Food Facts and USDA FoodData Central.
- Strava integration: deferred to phase-2/after-phase-1 stabilization.
- Voice/LLM: on-device capture + optional local/hosted LLM parsing through personal agent API.
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
- Current schema version: `4`.
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
