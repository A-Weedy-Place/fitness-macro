# Local diagnostic history (replaces cloud test telemetry)

As of 0.3.0, the app has **no automatic cloud diagnostic upload** and no Cloudflare telemetry endpoint. Existing private D1 test records are an archival owner dataset; this migration does not delete them.

In **You → Backup & restore**, optional local testing history is off by default. When enabled it records meaningful navigation, actions, AI interactions and state snapshots locally. It is bounded to 400 events / approximately 500 KB, with oversized payloads omitted. It is not a promise of complete lossless history.

Keys and credential fields are redacted. Raw audio is not included. History may contain private food/profile/chat data: share only explicitly with a trusted person. Clear local history removes this history and the obsolete unsent cloud queue, not the diary or secure API key.

The separate compact AI diagnostics remain phone-local and are also redacted. No developer can automatically read this device history. A user must explicitly share it for remote debugging.

This supersedes historical instructions for automatic preview telemetry, D1 queries, shared access tokens and cloud clearing. Do not reintroduce those paths without a new explicit product decision and consent design.
