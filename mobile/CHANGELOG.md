# Changelog

## 0.3.0 (2026-09-21)

- Bring your own Groq key in You → AI & API key; masked entry, validation, replacement and removal using device SecureStore.
- Whisper transcription and GPT-OSS planning run directly from the app against Groq, with no PC, shared developer key or Cloudflare relay.
- Manual catalogue lookup needs no key. Existing confirmation, portion validation and two-model-call ceiling remain.
- Removed automatic cloud test uploads; optional local diagnostics are redacted, bounded and explicitly shareable.
- Breaking setup change: existing users must add their own Groq key for AI. Native runtime remains 0.2.2; no reinstall or diary reset required.

## [0.2.4](https://github.com/A-Weedy-Place/fitness-macro/compare/v0.2.3...v0.2.4) (2026-09-09)

- Android Back closes settings/cookbook subviews before returning to Today; selected foods require confirmation before discard.
- Fixed Charcoal text/icon contrast without changing Warm Harvest or restarting themes.
- Food selection has a fixed Review & edit control, selection feedback and Undo, with durable-save and double-submit protection.
- Faster delivery: one versioned fix PR and CI gate per batch; optional release-bot workflow rather than a second mandatory PR.

## [0.2.3](https://github.com/A-Weedy-Place/fitness-macro/compare/v0.2.2...v0.2.3) (2026-09-09)


### Bug Fixes

* harden diary, AI, health sync and preview updates ([e866beb](https://github.com/A-Weedy-Place/fitness-macro/commit/e866beb76ab469bc8f801f855088484c69402e36))

## [0.2.2](https://github.com/A-Weedy-Place/fitness-macro/compare/v0.2.1...v0.2.2) (2026-09-04)


### Bug Fixes

* **mobile:** harden phone test experience ([025baed](https://github.com/A-Weedy-Place/fitness-macro/commit/025baedf0628f0c63f2a7b20e4fbbd218c451a27)), closes [#24](https://github.com/A-Weedy-Place/fitness-macro/issues/24)

## [0.2.1](https://github.com/A-Weedy-Place/fitness-macro/compare/v0.2.0...v0.2.1) (2026-09-04)


### Bug Fixes

* **mobile:** harden startup recovery ([d905d52](https://github.com/A-Weedy-Place/fitness-macro/commit/d905d52215e415f4167caa654b133075ad538c95)), closes [#19](https://github.com/A-Weedy-Place/fitness-macro/issues/19)

## [0.2.0](https://github.com/A-Weedy-Place/fitness-macro/compare/v0.1.0...v0.2.0) (2026-09-04)


### Features

* **testing:** add private telemetry pipeline ([03120b6](https://github.com/A-Weedy-Place/fitness-macro/commit/03120b6b23b8860468e97ca9fee5e8bcf8b36a02)), closes [#12](https://github.com/A-Weedy-Place/fitness-macro/issues/12)

## 0.1.0 (2026-09-03)


### Features

* add self-updating v0.1.0 release pipeline ([3ff4ffb](https://github.com/A-Weedy-Place/fitness-macro/commit/3ff4ffbe56c774fb0d0b3b6ab86c3c75075b8ba9))

## Changelog

Notable changes to Weed Fitness are recorded here. Releases follow Semantic Versioning.
