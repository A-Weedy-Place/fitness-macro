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

## Local checks

```powershell
cd mobile
npm ci
npm run typecheck
npm test

cd ..\relay
npm ci
npm run typecheck
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
