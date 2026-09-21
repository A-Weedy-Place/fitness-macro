# Standalone test guide — BYOK

1. Existing runtime 0.2.2 preview users: **You → Updates → Check for updates**, download and restart when ready. Do not uninstall or reset your diary.
2. Open **You → AI & API key → Get a key from Groq**. Create your own Groq key, paste it and **Save & check**. Never send the key to the developer. Use a Free account if you do not want paid usage.
3. Check invalid-key feedback. Failed validation must not replace a working key. Remove the key and verify manual logging/search/recipes still work; save it again for AI.
4. Ask for two whole wheat rotis and mash ki dal at 1 PM. Review quantities, then Apply once. Check both diary entries and follow-up time changes.
5. Record speech, stop, check/edit the transcript, deliberately send the text, and confirm the proposal. Transcription alone must not log food.
6. Export a diary backup and optional local diagnostic history. Neither should contain the saved key. Restoring a diary backup must not import or replace a key.
7. Switch themes while in Settings; no reload or navigation reset. Test Android Back, keyboard and modal safe areas on a physical phone.
8. Health Connect requires the supported native APK and explicit permissions. Existing sync behavior is unchanged.

Local calorie targets are deterministic estimates, not a medical prescription. For an AI meal structure after adding a key, save the profile again. Adaptive targets require sufficient complete logging and weigh-ins; see the in-app explanation.

Groq account quotas apply independently to speech and reasoning. Validation reads model metadata, not a completion. A planner request uses at most two model calls (including correction/reference refinement). Quota, authentication and connection failures must not change the diary.

No shared developer key, Cloudflare service or automatic test upload is required. Optional diagnostics are off by default, bounded, redacted and phone-only; share explicitly when debugging. Old cloud test data, if any, remains a private archive rather than being deleted during migration.
