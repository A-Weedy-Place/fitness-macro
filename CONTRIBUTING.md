# Contributing to Weed Fitness

Thanks for helping improve the project. Changes should stay focused, testable, and easy to review.

## Development flow

1. Open or choose an issue.
2. Update `main`, then create a short-lived branch such as `fix/17-login-crash` or `feat/24-meal-reminders`.
3. Make the smallest complete change that solves the issue.
4. Run the relevant checks.
5. Push the branch and open a pull request. Do not push feature work directly to `main`.
6. Address failures and review notes in the same pull request.
7. Squash-merge after CI passes.

## Owner delivery contract

Every product change follows this traceable path, including work done by Codex:

1. A GitHub issue defines the problem, acceptance checks, and whether it changes the native app.
2. Work happens on `codex/issue-<number>-short-description`, never directly on `main`.
3. The branch is pushed and a pull request links the issue with `Closes #<number>`.
4. GitHub Actions must pass before merge. The PR contains the tests performed and whether an EAS Update or new APK is needed.
5. Include version/changelog/context in this same PR. After the single CI gate, squash-merge and create the immutable tag and GitHub Release. Release Please is optional, not a second required PR.
6. For native changes—or when the owner explicitly requests a fresh installable test build—run **Build release APK** for that tag. Choose `preview` for owner testing and `production` only for a future public-ready build. The workflow builds the exact tag, downloads the signed APK from EAS, and attaches the profile-labelled file to the matching GitHub Release. For compatible JavaScript/assets, a preview EAS Update may be tested first.

Do not call an Expo artifact alone a release. The GitHub Release is the permanent release record and carries the APK when a new native build is required.

## Local checks

```powershell
cd mobile
npm ci
npm run typecheck
npm test
```

## Commit and PR titles

Use Conventional Commit style because release automation uses it to decide the next version:

- `fix(food): preserve serving size while editing`
- `feat(updates): add manual update checks`
- `docs: explain standalone installation`
- `chore: update development tooling`

Use `!` or a `BREAKING CHANGE:` footer only for incompatible changes.

## Choosing update or APK release

An EAS Update is appropriate for compatible JavaScript, TypeScript, and asset changes. A new APK is required after changing native dependencies, Expo plugins, permissions, the Expo SDK, or other native configuration.

Never publish an update simply to make a failed CI run disappear. Test it on the `preview` channel before promoting the same commit to `production`.
