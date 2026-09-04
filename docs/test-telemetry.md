# Private test telemetry

This is a temporary, owner-authorised **preview-build** facility for finding real failures while Weed Fitness is still a private test project. It is not part of the planned public product.

## What the preview build sends automatically

- App navigation, profile panel views, food searches/results, food/detail editor opens, and important local state commits.
- Structured before/after deltas for foods, diary entries, weights, activities, saved days, recipes, profile, and goals, so a log/edit/delete can be distinguished without guessing from a generic success message.
- The complete test diary snapshot needed to reproduce a state: profile measurements, foods, recipes, diary entries, weight, activities, goals, plans, and nutrition program. Device-only image paths are excluded.
- Typed AI commands, speech transcripts, assistant replies, proposed action ingredients/amounts, confirmation/apply outcomes, and safe relay error codes.

It never sends the Groq key, relay access token, local PIN, raw voice audio, device photo files, or indiscriminate screen/touch recordings. “Everything” in private testing means every meaningful product action and resulting state. Telemetry is queued locally while offline, uploaded in batches of up to ten, and retried later; it must never block a food log, edit, or any other normal action.

## Storage and removal

- Only APKs built from the Expo `preview` environment receive `EXPO_PUBLIC_TEST_TELEMETRY=enabled`. Production does not.
- Events are written through the existing private Cloudflare Worker into the private D1 database `weed-fitness-test-telemetry`; it is not in GitHub and is not public.
- The Worker removes records older than 90 days. **You → Backup & restore → Clear this phone's cloud test data** immediately deletes the remote events associated with that test phone; subsequent preview activity starts a new trail automatically.

## Evidence-based debugging

The owner can query the private database from the authenticated project computer. For example:

```powershell
cd relay
npm exec --yes --package=wrangler -- wrangler d1 execute weed-fitness-test-telemetry --remote --command "SELECT received_at, device_id, event_type, payload_json FROM test_telemetry_events ORDER BY id DESC LIMIT 100"
```

Use targeted queries for a particular device or failure window. Never paste database contents into a public issue, pull request, GitHub release, or a public chat.

Before a public release, remove this build flag, delete the Worker telemetry routes and D1 binding/migration, and delete the D1 database after exporting anything the owner explicitly wants to retain.
