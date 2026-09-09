# Releases and in-app updates

Required workflow: issue → codex branch → tested PR → CI → merge → Release Please version/changelog PR → merge/tag/GitHub Release → publish the exact tag. No direct feature commits to main. Update context.md and the Obsidian mirror each stage.

## Compatible preview update

Use for JavaScript/TypeScript/assets without native changes. Current installed owner APK: v0.2.2, native runtime `0.2.2`, channel `preview`.

1. Follow the tracked workflow and create the version tag.
2. Run Actions → Publish app update, enter that exact tag, choose preview, add a short description.
3. Verify successful Android update publication, runtime0.2.2 and channel mapping. Record the group and release evidence.
4. Owner opens You → Updates → Check for updates → downloads → restarts when ready. The JavaScript version advances while the installed APK version remains0.2.2. Themes themselves never need a restart.

The repository can remain private: EAS hosts the update separately, without putting GitHub credentials in the app. Do not publish private owner testing to production by default.

runtimeVersion is explicit, independent of the patch release version. It remains0.2.2 only while native dependencies/configuration stay compatible. Any native dependency, plugin, permission, Expo SDK or native configuration change MUST bump it and ship a replacement APK. Do not force incompatible code into an old runtime.

## New APK

After a native change and versioned release, run Actions → Build release APK on the exact tag with preview for owner testing. The workflow checks, builds, and attaches the signed profile-labelled APK to GitHub Releases. EAS increments Android versionCode; install over the existing app to preserve data. Never uninstall as an update instruction or silently replace a tagged artifact. Do not label an old APK as the current release.

## Credentials and rollback

Both delivery workflows use GitHub Actions secret EXPO_TOKEN. Keep it out of chat/source/logs; revoke and replace any exposed token before relying on it. The EAS preview environment supplies the separate extractable EXPO_PUBLIC_RELAY_ACCESS_TOKEN and temporary telemetry flag. Proper account/device authentication is required before public distribution.

Rollback a bad compatible update through its EAS channel. Test schema migrations forward/backward before rollback: previous JavaScript may not understand newly written state. A native defect requires a new tagged APK. Keep recovery data; never erase the diary to make an update appear successful.
