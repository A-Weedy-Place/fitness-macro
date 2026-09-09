# Owner reliability test stage — issue29

Use the installed v0.2.2 preview APK and its compatible update. Source stays private. No paid API, PC connection or key entry is needed on the phone.

## Automated coverage

Mobile regression suites cover units, domain validation, exact AI proposal preview, persisted writes/concurrent changes, nutrition and target history, Health Connect deduplication/reconciliation/timezones, adaptive intake/weight alignment, backup validation/recovery, portable media, telemetry concurrency/byte budgets and live themes. Relay tests cover AM/PM parsing, matching, separate quotas, safe failures, reference attribution and the two-model-call ceiling. CI runs both suites and typechecks.

Android/Hermes export must succeed. No native dependencies/permissions/plugins changed in this patch; runtime remains0.2.2. Device-specific UI, storage-provider and Health Connect behaviour still require phone testing.

## Phone checklist

1. You → Updates: download/apply the compatible update. Confirm the app-code version changes while APK/runtime remain0.2.2. Do not uninstall.
2. Appearance: change Warm Harvest → another palette → Warm Harvest. Colours should change immediately, with the same panel and chat preserved.
3. Ask AI to log150ml milk and then a separate milk amount at another time. Inspect exact amounts/calories before applying. Confirm each diary item once. Move one to tomorrow without naming a time: the old clock time should stay.
4. Create/log a composite drink. Inspect its ingredient recipe and batch/serving counts. If a reference is found, inspect its source/license; calories must still say estimated.
5. Edit a reusable recipe: old diary totals should stay fixed. Change an old entry's portion: only that entry recalculates.
6. Mark a finished past food day complete. Edit any food: that day should reopen. Incomplete days must not cause an adaptive target cut.
7. Sync Health Connect twice: no duplicates. Correct/delete a source record, sync again: complete covered imports reconcile; manual weight remains. Lack of upstream records is not proof of a sync defect.
8. Export a JSON backup with a custom photo, then test preview/restore and recovery. Invalid JSON or an unrelated object must be rejected. Keep a recovery file before testing; do not uninstall to simulate another device.
9. Backup & restore → test upload status: queue should upload when online. New chat, navigation, log/edit/delete and safe failures should be observable in private diagnostics.

## Explicit remaining boundaries

Private preview authentication is a shared extractable relay token; public account/device auth is still a release gate. Telemetry is owner-authorized test-only, bounded and excludes secrets/audio/photos. Health sync is foreground/manual, not guaranteed continuous background capture. Catalog and reference coverage are incomplete, and LLM extraction is not infallible; confirmation must show actual proposed actions. Old unsnapshotted historical values can only be captured from data currently available, not reconstructed retroactively.

The relay production-dependency audit has no advisories at this checkpoint. Three development-only high findings refer to the same Wrangler/Miniflare/Sharp dependency chain; no forced incompatible tooling downgrade was applied. Avoid processing untrusted HEIF/AVIF through that developer tooling pending a compatible patch.
