# Implementation roadmap

## Completed standalone baseline

- [x] Local-first diary, cookbook, recipes, plans, trends, profile, themes, local PIN, and JSON backup/restore.
- [x] Deterministic BMR/TDEE and safety-bounded macro targets, plus an AI-personalized flexible meal structure.
- [x] Voice transcription through Groq Whisper and confirmation-gated GPT-OSS food/action plans.
- [x] Private Cloudflare Worker relay with encrypted Groq secret; no PC service or phone-side Groq key.
- [x] Open Food Facts reference search and barcode lookup through the relay.
- [x] Android preview APK configuration and native Health Connect support.

## Next user-tested stages

- [ ] Validate this standalone APK on the owner’s phone and collect focused UI/agent feedback.
- [ ] Improve South Asian food reference coverage and reviewed-recipe provenance.
- [ ] Add a secure hosted activity/Strava connection only after the AI flow is stable.
- [ ] Add real account/device authentication and global rate limiting before broader distribution.
- [ ] Move local persistence from AsyncStorage to SQLite before larger long-term diaries.
