# Releases and in-app updates

Weed Fitness has two delivery paths with different safety boundaries.

## Compatible in-app update

Use this for JavaScript, TypeScript, and asset changes that do not alter the native runtime.

1. Merge a tested pull request.
2. Open **Actions → Publish app update → Run workflow**.
3. Publish to `preview` first and test it in a preview build.
4. Run the workflow again for `production` from the same commit.
5. Installed production builds check automatically at startup. The owner can also use **You → Updates → Check for updates** and restart immediately after download.

EAS only serves updates whose runtime version matches the installed build. The runtime is tied to the public app version, so an incompatible update cannot intentionally cross release boundaries.

## New APK release

Use this after changing native dependencies, plugins, permissions, native configuration, or the Expo SDK.

1. Merge normal PRs using Conventional Commit titles.
2. Release Please maintains a release PR with the next version and changelog.
3. Merge that release PR. It creates the version tag and GitHub Release.
4. Open **Actions → Build release APK**, enter the new tag, and choose `preview` for private owner testing or `production` for an eventual public-ready build.
5. The workflow checks out the exact tag, runs CI, creates a signed APK with the chosen EAS profile, and attaches a profile-labelled file to the GitHub Release. Preview builds include the temporary automatic test telemetry; production builds do not.

The first tracked release is `v0.1.0`. EAS remotely increments Android's internal `versionCode`; the human-facing version remains controlled by the release PR.

## Required delivery sequence

Use this sequence for every owner test stage: GitHub issue → `codex/issue-<number>-...` branch → tested pull request that closes the issue → merge → Release Please version/changelog pull request → merge/tag/GitHub Release → release workflow attaches the signed APK. Keep the direct EAS link only as a temporary convenience; the GitHub Release is the permanent download record.

## Required repository secret

Both delivery workflows require an Expo personal access token stored as the repository GitHub Actions secret `EXPO_TOKEN`. Never place it in source code, an issue, a PR, or a workflow file.

The relay access token remains an EAS environment variable. The `preview` and `production` EAS environments must each contain `EXPO_PUBLIC_RELAY_ACCESS_TOKEN` until the relay is replaced with real account/device authentication.

## Rollback

If a compatible update is broken, use EAS Update rollback for its channel. If a native release is broken, fix it in a PR, create a new patch release, and publish a new APK; never replace an existing tagged artifact silently.
