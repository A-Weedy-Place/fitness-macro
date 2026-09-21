# Releases and in-app updates

## Fast, tracked preview delivery (owner-approved September 2026)

Required default: **one issue → one codex branch/PR containing the fixes AND patch version/changelog/context → one passing PR CI gate → squash merge → tag/GitHub Release → publish the exact tag to preview**. No direct feature commits to main. Update context.md and the Obsidian mirror in that same PR. Release Please remains manual/optional for larger releases, not a second mandatory PR for small preview patches.

- Batch related feedback; do not create an issue or PR for each tiny adjustment.
- During implementation run focused regression tests; before handoff run the changed package's full tests/typecheck once on the final code. Rerun if affected code changes or a test fails. PR CI is the independent reproducible gate. Do not repeat identical CI on main after a checked squash merge.
- Include app.config.js, package.json/lock, the version manifest and CHANGELOG in the feature PR. Verify native/runtime compatibility before tagging. Never reuse or overwrite a released tag.
- Publish JavaScript-only changes through OTA, not a new APK. One publication plus an endpoint/runtime check is enough. Do not redeploy an unchanged Worker or spend AI calls on unrelated visual patches.
- Batch scoped permission requests when possible and use approved CLI prefixes. Never bypass sandbox approvals or request broad shell permissions just for speed. Secrets, native compatibility, user-data integrity and failing checks remain hard stops.
- Give one short install instruction and a focused phone test checklist. Record the exact tag SHA, update group/channel/runtime on the GitHub Release. No need for another source commit solely to repeat the publication ID.

## Compatible preview update

Use for JavaScript/TypeScript/assets without native changes. Current installed owner APK: v0.2.2, native runtime `0.2.2`, channel `preview`.

1. Follow the single-PR tracked workflow above and create the version tag.
2. Run Actions → Publish app update, enter that exact tag, choose preview, add a short description.
3. Verify successful Android update publication, runtime0.2.2 and channel mapping. Record the group and release evidence.
4. Owner opens You → Updates → Check for updates → downloads → restarts when ready. The JavaScript version advances while the installed APK version remains0.2.2. Themes themselves never need a restart.

The repository is now public; it could also remain private: EAS hosts the update separately, without putting GitHub credentials in the app. Do not publish private owner testing to production by default.

runtimeVersion is explicit, independent of the patch release version. It remains0.2.2 only while native dependencies/configuration stay compatible. Any native dependency, plugin, permission, Expo SDK or native configuration change MUST bump it and ship a replacement APK. Do not force incompatible code into an old runtime.

## New APK

After a native change and versioned release, run Actions → Build release APK on the exact tag with preview for owner testing. The workflow checks, builds, and attaches the signed profile-labelled APK to GitHub Releases. EAS increments Android versionCode; install over the existing app to preserve data. Never uninstall as an update instruction or silently replace a tagged artifact. Do not label an old APK as the current release.

## Credentials and rollback

Both delivery workflows use GitHub Actions secret EXPO_TOKEN. Keep it out of chat/source/logs; revoke and replace any exposed token before relying on it. AI uses each user's Groq key stored in device SecureStore, not EAS environment variables. No relay access token or automatic cloud telemetry belongs in a build.

If the GitHub publishing token is untrusted, a separately authenticated local Expo session may publish the exact tested tag with `eas update --platform android --channel preview --environment preview --message <release-note> --non-interactive`. Verify EXPO_TOKEN is absent from that shell; do not use the exposed credential as a fallback. Record the tag commit, update group, channel and runtime on the GitHub Release. This retains the issue/PR/CI/versioned-release trail; it does not authorize an untracked development update. The exposed token still needs revocation/replacement.

Rollback a bad compatible update through its EAS channel. Test schema migrations forward/backward before rollback: previous JavaScript may not understand newly written state. A native defect requires a new tagged APK. Keep recovery data; never erase the diary to make an update appear successful.
