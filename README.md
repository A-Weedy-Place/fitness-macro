# Local-First Nutrition App

Goal: deliver a mobile-first nutrition workflow similar to MacroFactor/FitnessPal without paid third-party lock-in, with local ownership first and optional local PC enrichment.

## Current repo structure
- `agent/` local PC service with a REST contract for nutrition lookup, weighting, entries, and export.
- `mobile/` Expo app skeleton with local-first state, meal/weight models, and sync hooks to the agent.
- `context.md` evolving project memory, decisions, and risk log.

## Runbook (bootstrap)
1. Start agent service:

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\agent
npm install
npm run dev:env
```

2. Start mobile app:

```powershell
Set-Location C:\Users\pc\Desktop\UwU\fitness\mobile
npm install
npm start -- --lan
```

3. Open in Expo Go on phone or simulator.

## What is already implemented in this baseline
- Agent API endpoints for search/barcode/resolve/custom foods/entries/weights/activities/profile/goals/export
- Token-based agent pairing
- JSON persistence with schema versioning on agent and mobile
- Mobile diary, macro targets, custom foods, weight trend, manual activity logging, and offline replay queue
- Expo SDK 57 / React Native 0.86 baseline aligned with the current stable Expo compatibility table
- Project notes + Obsidian sync target

## Security model
- The mobile app keeps primary user data on-device.
- Agent is optional; it is called only for food enrichment and optional remote fallback.
- Token header is required for all agent routes: `x-agent-token`.
- All PC sync endpoints are intentionally minimal and audit-friendly.

## Why this scaffolding matters
- You avoid dependency on MyFitnessPal/MacroFactor public APIs.
- You get control over the food model, country-specific entries, and future Strava extension.
- You can improve parsing and voice flows in phase 2 without changing local schema.

## Planned milestones
- Phase 0: local schema + agent contract + offline-first baseline
- Phase 1: diary + macro math + weight trend + recipe support
- Phase 2: Groq voice/LLM extraction path + confidence-based confirmation
- Phase 3: optional Strava OAuth/activity import
- Phase 4: polish, export/import, conflict resolution

## Data schema version
- Current version in store: `5`

## Current mobile experience

The app now uses five dedicated tabs for daily logging, reusable food plans, detailed trends, food intelligence, and profile/targets. Graphs include calorie-vs-target bars, weight plus rolling trend, macro energy split, logging consistency, and calories by meal.

See `docs/testing-guide.md` before the first phone test.

For the current no-subscription Groq transcription and food-agent setup on Windows, see `docs/free-groq-agent-setup.md`.

## Open questions for next pass
- Obsidian vault sync path and cadence
- CSV export format details
- Strava ingestion method (webhook vs polling first)
