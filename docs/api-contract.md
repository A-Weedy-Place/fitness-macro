# API Contract (schema 4)

## Authentication

All `/v1/*` routes require `x-agent-token`. `/health` is the only public endpoint. Set `AGENT_PAIRING_TOKEN` before using the service over a LAN.

## Foods

- `GET /v1/foods/search?q=<string>&limit=<n>` searches local cache, Open Food Facts, and optional USDA.
- `GET /v1/foods/barcode/:code` checks local cache and Open Food Facts.
- `POST /v1/foods/custom` saves normalized per-100-g nutrition.
- `POST /v1/foods/resolve` turns a transcript into confirmation candidates.

## Diary

- `POST /v1/entries` creates or replaces an entry by `clientId`.
- `GET /v1/entries?date=<date>` returns one day; omitting `date` returns all history.
- `DELETE /v1/entries/:id` removes an entry and records a delete sync event.

## Weight and activity

- `POST /v1/weights` and `DELETE /v1/weights/:id` manage weight logs.
- `GET /v1/weights?from=<date>&to=<date>` returns weight history.
- `POST /v1/activities` and `DELETE /v1/activities/:id` manage manual activity records.
- `GET /v1/activities?from=<date>&to=<date>` returns activity history.

## Profile and targets

- `GET /v1/profile` returns the profile.
- `PUT /v1/profile` returns profile, BMR, TDEE, and recommended macros.
- `GET /v1/goals` and `PUT /v1/goals/:date` manage daily target overrides.

## Reusable food plans

- `GET /v1/plans` lists templates.
- `POST /v1/plans` saves a template with meal buckets, food references, and portions.
- `DELETE /v1/plans/:id` removes a template.

Applying a plan happens on-device by generating fresh, idempotent diary entries for the selected date.

## Ownership and storage

- `GET /v1/export` returns the complete schema 4 JSON snapshot.
- Set `AGENT_DATA_DIR` to use a database directory other than `agent/data`.
- Agent JSON writes use a temporary file and atomic rename.
- Client-generated IDs make offline retries duplicate-safe.
