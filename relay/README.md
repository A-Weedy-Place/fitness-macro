# Weed Fitness private relay

This Cloudflare Worker is a deliberately thin private relay:

- It keeps `GROQ_API_KEY` in a Cloudflare encrypted secret; the key is never shipped in the mobile app or committed.
- It supports transcription, typed plans, manual food lookup, and optional recipe ingredient references. No PC service or CLI model is involved.
- The diary is local-first. **Private preview telemetry deliberately uploads owner-authorized diary/profile snapshots, chat and interaction diagnostics to private D1 for debugging**, retained up to 90 days. Production telemetry is disabled. Raw audio, secrets, PINs and image bytes are not telemetry payloads.
- `APP_ACCESS_TOKEN` protects this personal-test APK from casual third-party use. It is not a replacement for user authentication because an APK can be inspected. Add account authentication before public distribution.

Deploying requires the existing Cloudflare secrets. Apply the D1 migrations before the Worker deployment; `0002_route_limits.sql` adds the atomic route counters used by this revision:

```powershell
wrangler secret put GROQ_API_KEY
wrangler secret put APP_ACCESS_TOKEN
wrangler d1 migrations apply weed-fitness-test-telemetry --remote
wrangler deploy
```

The app sends a rotatable private-build token in `x-fitnessmacro-app-token`; it never has access to the Groq key. The build token is extractable and does not automatically expire.

## AI correctness and cost boundary

- Shared relay/phone domain validation rejects malformed dates/times, unusable portions and unsafe calorie targets. Existing saved foods retain their authoritative nutrition.
- Context contains actual `currentDate`, distinct `selectedDiaryDate`, and at most six history messages/3,000 characters. Regional aliases are shared with the phone's search helper.
- One normal model call; at most one additional call for validation correction and/or recipe enrichment combined. There is no third call or paid fallback. An optional reference failure leaves a valid proposal explicitly labelled AI-estimated.
- Authenticated status (600/hour), catalogue (120/hour), reasoning (60/hour), transcription (60/hour), and telemetry (240/hour) have independent D1-backed counters. These are app safeguards, not a promise about provider quotas. Groq can rate-limit sooner. Both provider and relay limits return distinct codes and `Retry-After`/`retryAfterSeconds`. The no-D1 local-development fallback is per-process only.

## Recipe references and licensing

For at most two newly proposed dishes, the Worker queries the free public Wikibooks Cookbook API, checks the dish title, and reads only an ingredient section from a fixed page revision. Matching references can inform the one refinement call. `GET /v1/recipes/reference?q=...` also exposes this optional lookup. Missing/failed lookup returns `reference: null`; it never fabricates a source.

Referenced ingredients are attributed to Wikibooks contributors and marked as adapted under [CC BY-SA 4.0](https://en.wikibooks.org/wiki/Wikibooks:Copyrights), with a revision URL and change/estimate notice. Retain that attribution/license when exporting or redistributing adapted recipes. Cooking prose and images are not imported. The source is an ingredient reference, **not verified calories/macros**; model-invented citation URLs are discarded. Manual or existing personal recipes are never automatically overwritten.

Implementation reference: [MediaWiki Search API](https://www.mediawiki.org/wiki/API:Search).

## Validation

Run `npm ci`, `npm run typecheck`, and `npm test` from `relay`. Behavioral tests cover 12-hour time parsing, alias/history retrieval, serving conversion, domain bounds, target-ID moves, rate-limit responses, reference matching/attribution and the two-call ceiling, with mocked providers and no paid/API traffic.
